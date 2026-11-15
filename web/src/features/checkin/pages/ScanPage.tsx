import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventContext } from "@/lib/event-context";
import { formatTime } from "@/lib/format/date";
import { formatTicketCode } from "@/lib/format/ticket-code";
import { routes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CameraOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAdmissionStats, useCheckIn } from "../api";
import { type ScanFeedback, type ScanTone, describeCheckin } from "../scan-result";

/** Gates we always offer, even before an event has any check-in. */
const FALLBACK_GATES = ["gate-1", "gate-2", "gate-3", "gate-4"];

const TONE_SURFACE: Record<ScanTone, string> = {
  success: "bg-success text-foreground",
  warning: "bg-warning text-foreground",
  error: "bg-destructive text-primary-foreground",
  neutral: "bg-secondary text-foreground",
};

const TONE_DOT: Record<ScanTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
  neutral: "bg-muted-foreground",
};

type CameraState = "off" | "starting" | "on" | "error";
type HistoryItem = { id: string; at: string; label: string; feedback: ScanFeedback };

let audioContext: AudioContext | null = null;

/** Safari only exposes the prefixed constructor. */
function resolveAudioContext(): typeof AudioContext | undefined {
  const candidate = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  return candidate.AudioContext ?? candidate.webkitAudioContext;
}

/** Short beeps for the gate; the colour block already carries the result if audio is blocked. */
function playBeeps(count: number, durationMs: number) {
  if (count <= 0) return;
  const AudioCtor = resolveAudioContext();
  if (!AudioCtor) return;
  try {
    audioContext ??= new AudioCtor();
    const context = audioContext;
    void context.resume();
    for (let index = 0; index < count; index += 1) {
      const start = context.currentTime + (index * (durationMs + 80)) / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + durationMs / 1000);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + durationMs / 1000);
    }
  } catch {
    // Audio blocked by the OS or browser; scanning still works.
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is optional.
  }
}

export function ScanPage() {
  const queryClient = useQueryClient();
  const checkIn = useCheckIn();
  const { eventId } = useEventContext();
  // Polling paused: the gate screen only needs the list of gates, not live counters.
  const statsQuery = useAdmissionStats(eventId, true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const checkInRef = useRef(checkIn);
  const gateRef = useRef(FALLBACK_GATES[0]);
  const continueRef = useRef<HTMLButtonElement>(null);
  const manualRef = useRef<HTMLInputElement>(null);

  const [gate, setGate] = useState(FALLBACK_GATES[0]);
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState<CameraState>("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanFeedback | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Real gates come from the event's check-in counters; fall back to a fixed list.
  const gates = useMemo(() => {
    const used = (statsQuery.data?.byGate ?? []).map((row) => row.gate);
    return [...new Set([...FALLBACK_GATES, ...used, gate])];
  }, [statsQuery.data, gate]);

  useEffect(() => {
    checkInRef.current = checkIn;
  }, [checkIn]);

  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  useEffect(() => {
    if (result) continueRef.current?.focus();
  }, [result]);

  const dismiss = useCallback(() => {
    setResult(null);
    busyRef.current = false;
    manualRef.current?.focus();
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const token = raw.trim();
      if (!token || busyRef.current || checkInRef.current.isPending) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last?.code === token && now - last.at < 3000) return;
      lastScanRef.current = { code: token, at: now };
      busyRef.current = true;

      const mutation = checkInRef.current;
      void (async () => {
        const outcome = await mutation.mutateAsync({ qrToken: token, gate: gateRef.current });
        const feedback = describeCheckin(outcome);
        setResult(feedback);
        playBeeps(feedback.beeps.count, feedback.beeps.durationMs);
        vibrate(feedback.vibrate);
        setHistory((items) =>
          [
            {
              id: `${now}-${items.length}`,
              at: new Date(now).toISOString(),
              label: outcome.ticketId
                ? formatTicketCode(outcome.ticketId)
                : (outcome.attendeeName ?? "Vé không rõ"),
              feedback,
            },
            ...items,
          ].slice(0, 10),
        );
        if (feedback.tone === "success" || feedback.tone === "warning") {
          void queryClient.invalidateQueries({ queryKey: ["checkins"] });
          void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        }
      })();
    },
    [queryClient],
  );

  const startCamera = useCallback(async () => {
    setCamera("starting");
    setCameraError(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const video = videoRef.current;
      if (!video) throw new Error("Thiếu vùng hiển thị camera");
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, video, (scan) => {
        if (scan) submit(scan.getText());
      });
      setCamera("on");
    } catch {
      setCamera("error");
      setCameraError(
        "Không mở được camera. Cấp quyền camera cho trình duyệt hoặc dán nội dung mã QR vào ô bên dưới.",
      );
    }
  }, [submit]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCamera("off");
  }, []);

  useEffect(() => () => controlsRef.current?.stop(), []);

  useEffect(() => {
    if (!result) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, dismiss]);

  return (
    <div className="flex flex-col gap-6">
      <header inert={Boolean(result)} className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-foreground">Quét vé</h1>
          <p className="text-sm text-muted-foreground">
            Cổng {gate} · thiết bị {gate} · soát online, cần mạng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={gate} onValueChange={setGate}>
            <SelectTrigger aria-label="Cổng soát vé" className="h-11 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gates.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="secondary">
            <Link to={routes.checkins()}>Theo dõi</Link>
          </Button>
        </div>
      </header>

      {cameraError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Camera chưa mở được</AlertTitle>
          <AlertDescription>{cameraError}</AlertDescription>
        </Alert>
      ) : null}

      <section inert={Boolean(result)} aria-label="Camera quét mã" className="flex flex-col gap-3">
        <div className="relative min-h-[52vh] w-full overflow-hidden rounded-card bg-foreground/90">
          <video ref={videoRef} muted playsInline className="size-full object-cover">
            <track kind="captions" />
          </video>
          {camera !== "on" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-primary-foreground">
              <Camera className="size-10" aria-hidden="true" />
              <p className="text-title">
                {camera === "starting" ? "Đang mở camera…" : "Camera đang tắt"}
              </p>
              <p className="max-w-[36ch] text-sm">
                Bật camera để quét mã QR trên vé, hoặc dán nội dung mã vào ô bên dưới.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {camera === "on" ? (
            <Button variant="secondary" onClick={stopCamera}>
              <CameraOff aria-hidden="true" />
              Tắt camera
            </Button>
          ) : (
            <Button onClick={() => void startCamera()} disabled={camera === "starting"}>
              <Camera aria-hidden="true" />
              {camera === "starting" ? "Đang mở…" : "Bật camera"}
            </Button>
          )}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            submit(manual);
            setManual("");
          }}
        >
          <Input
            aria-label="Dán nội dung mã QR"
            placeholder="Dán nội dung mã QR khi không dùng được camera"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            ref={manualRef}
            className="h-11 sm:max-w-[420px]"
          />
          <Button type="submit" variant="secondary" disabled={!manual.trim()}>
            Soát vé
          </Button>
        </form>
      </section>

      <Card inert={Boolean(result)}>
        <CardHeader>
          <CardTitle className="text-title">Lịch sử 10 lần gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <Empty className="p-6">
              <EmptyHeader>
                <EmptyTitle>Chưa quét vé nào trong phiên này</EmptyTitle>
                <EmptyDescription>
                  Kết quả mỗi lần quét hiện toàn màn hình và được lưu 10 lần gần nhất tại đây.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ol className="flex flex-col">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setResult(item.feedback)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-secondary"
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-pill ${TONE_DOT[item.feedback.tone]}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-sm text-foreground">{item.label}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {item.feedback.title}
                    </span>
                    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                      {formatTime(item.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {result ? (
        <output
          aria-live="polite"
          className={`fixed inset-0 z-50 flex flex-col ${TONE_SURFACE[result.tone]}`}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-display">{result.title}</p>
            <p className="text-headline font-bold">{result.detail}</p>
          </div>
          <div className="flex flex-col items-center gap-3 px-6 pb-10">
            <Button
              onClick={dismiss}
              ref={continueRef}
              className="h-14 w-full max-w-md bg-card text-title text-foreground hover:bg-card/90"
            >
              Quét tiếp
            </Button>
            <p className="text-sm">Cổng {gate} · nhấn Esc để đóng</p>
          </div>
        </output>
      ) : null}
    </div>
  );
}
