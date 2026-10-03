import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import {
  Appbar,
  Card,
  Chip,
  Button,
  TextInput,
  Text,
  useTheme,
  Surface,
} from "react-native-paper";
import { useAuth } from "../../src/context/AuthContext";
import { useOfflineSync } from "../../src/context/OfflineSyncContext";
import { api } from "../../src/api/client";
import { hapticFeedback } from "../../src/services/haptics";
import { soundService } from "../../src/services/sound";
import { colors, m3Shapes } from "../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

type ScanFeedback = "IDLE" | "VALID" | "DUPLICATE" | "INVALID";

export default function ScannerScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const {
    isOnline,
    pendingCount,
    isSyncing,
    downloadCache,
    processOfflineScan,
    syncPendingQueue,
  } = useOfflineSync();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback>("IDLE");
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [feedbackAttendee, setFeedbackAttendee] = useState<string>("");
  const [stats, setStats] = useState<{ total: number; checkedIn: number; remaining: number } | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(true);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [manualToken, setManualToken] = useState("");

  const scanLock = useRef(false);
  const resetTimer = useRef<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isOnline) {
      downloadCache("any").catch(() => {});
    }
  }, [isOnline]);

  const fetchStats = async () => {
    try {
      const eventsRes = await api.getEvents();
      if (eventsRes?.events?.[0]?.id) {
        const statsRes = await api.getEventStats(eventsRes.events[0].id);
        setStats(statsRes);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const dismissFeedbackImmediately = () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    setFeedback("IDLE");
    setFeedbackMessage("");
    setFeedbackAttendee("");
    scanLock.current = false;
    setIsScanningActive(true);
  };

  const triggerFeedback = (
    type: ScanFeedback,
    message: string,
    attendee = ""
  ) => {
    setFeedback(type);
    setFeedbackMessage(message);
    setFeedbackAttendee(attendee);

    if (type === "VALID") {
      soundService.playSuccess();
      hapticFeedback.success();
    } else if (type === "DUPLICATE") {
      hapticFeedback.duplicate();
    } else if (type === "INVALID") {
      hapticFeedback.error();
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      dismissFeedbackImmediately();
    }, 650);
  };

  const processScannedToken = async (qrToken: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setIsScanningActive(false);

    try {
      if (isOnline) {
        try {
          const res = await api.verifyCheckin(qrToken, "device-staff-1");
          if (res?.status === "SUCCESS") {
            triggerFeedback(
              "VALID",
              "CHECK-IN HỢP LỆ",
              res.ticket?.attendeeName || "Khách tham dự"
            );
            fetchStats();
          } else {
            triggerFeedback("INVALID", res?.message || "MÃ KHÔNG HỢP LỆ");
          }
        } catch (err: any) {
          if (err.status === 409) {
            triggerFeedback(
              "DUPLICATE",
              "VÉ ĐÃ QUÉT TRƯỚC ĐÓ",
              err.data?.ticket?.attendeeName || ""
            );
          } else {
            triggerFeedback("INVALID", err.message || "MÃ KHÔNG HỢP LỆ HOẶC HẾT HẠN");
          }
        }
      } else {
        let ticketId = qrToken;
        try {
          const [dataB64] = qrToken.split(".");
          const base64Standard = dataB64.replace(/-/g, "+").replace(/_/g, "/");
          const parsed = JSON.parse(atob(base64Standard));
          if (parsed?.tid) ticketId = parsed.tid;
        } catch {}

        const offlineResult = await processOfflineScan(ticketId);
        if (offlineResult.status === "VALID") {
          triggerFeedback(
            "VALID",
            "CHECK-IN NGOẠI TUYẾN THÀNH CÔNG",
            offlineResult.ticket?.attendeeName || ""
          );
        } else if (offlineResult.status === "ALREADY_CHECKED_IN") {
          triggerFeedback(
            "DUPLICATE",
            "VÉ ĐÃ QUÉT TRƯỚC ĐÓ (Offline Cache)",
            offlineResult.ticket?.attendeeName || ""
          );
        } else {
          triggerFeedback("INVALID", "MÃ KHÔNG CÓ TRONG BỘ NHỚ ĐỆM");
        }
      }
    } catch {
      triggerFeedback("INVALID", "LỖI XỬ LÝ MÃ");
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanningActive || scanLock.current) return;
    processScannedToken(data);
  };

  const handleSyncNow = async () => {
    try {
      const res = await syncPendingQueue();
      Alert.alert(
        "Đồng bộ hoàn tất",
        `Đã xử lý: ${res.processed} vé\nThành công: ${res.synced}\nXung đột (Duplicate): ${res.conflicts}`
      );
    } catch (err: any) {
      Alert.alert("Lỗi đồng bộ", err.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Xác nhận đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản soát vé?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: logout },
      ]
    );
  };

  const getOverlayBackgroundColor = () => {
    switch (feedback) {
      case "VALID":
        return colors.success;
      case "DUPLICATE":
        return colors.warning;
      case "INVALID":
        return colors.error;
      default:
        return "transparent";
    }
  };

  return (
    <View style={styles.container}>
      {/* Material 3 Appbar Header */}
      <Appbar.Header elevated style={styles.appbar}>
        <Appbar.Content
          title="qCheck Scanner"
          titleStyle={styles.appbarTitle}
          subtitle={isOnline ? "Online Server" : "Chế độ Ngoại Tuyến (Offline)"}
          subtitleStyle={styles.appbarSubtitle}
        />

        <Appbar.Action
          icon={torch ? "flashlight" : "flashlight-off"}
          color={colors.black}
          onPress={() => setTorch(!torch)}
          accessibilityLabel={torch ? "Tắt đèn pin" : "Bật đèn pin"}
        />

        <Chip
          compact
          icon="cloud-upload"
          onPress={() => router.push("/(staff)/sync-status")}
          style={styles.syncChip}
          textStyle={styles.syncChipText}
        >
          {pendingCount} chờ sync
        </Chip>

        <Appbar.Action
          icon="logout"
          color={colors.black}
          onPress={handleLogout}
          accessibilityLabel="Đăng xuất tài khoản"
        />
      </Appbar.Header>

      {/* Floating Check-in Attendance Pill HUD */}
      {stats && (
        <Surface style={styles.statsHud} elevation={2}>
          <View style={styles.statItem}>
            <Text variant="labelSmall" style={styles.statLabel}>ĐÃ QUÉT</Text>
            <Text variant="titleMedium" style={{ color: colors.success, fontWeight: "800" }}>
              {stats.checkedIn}/{stats.total}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="labelSmall" style={styles.statLabel}>CÒN LẠI</Text>
            <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: "800" }}>
              {stats.remaining} vé
            </Text>
          </View>
        </Surface>
      )}

      {/* Camera View Area */}
      <View style={styles.cameraContainer}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={isScanningActive ? handleBarcodeScanned : undefined}
          />
        ) : (
          <Surface style={styles.permissionBox} elevation={2}>
            <Ionicons name="camera-outline" size={54} color={colors.textSecondary} />
            <Text variant="titleMedium" style={styles.permissionTitle}>
              Cần quyền truy cập Camera
            </Text>
            <Text variant="bodySmall" style={styles.permissionSubtitle}>
              Để quét mã Dynamic QR soát vé sự kiện tức thời
            </Text>
            <Button
              mode="contained"
              onPress={requestPermission}
              style={{ marginTop: 16, borderRadius: m3Shapes.full }}
            >
              Cấp quyền Camera
            </Button>
          </Surface>
        )}

        {/* Scan Target Reticle */}
        {feedback === "IDLE" && permission?.granted && (
          <View style={styles.reticleContainer}>
            <View style={styles.reticleSquare}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.reticleHint}>Căn mã Dynamic QR vào khung</Text>
          </View>
        )}

        {/* Multi-sensory Color Flash Feedback Overlay */}
        {feedback !== "IDLE" && (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={dismissFeedbackImmediately}
            accessibilityLiveRegion="assertive"
            accessibilityLabel={`Kết quả quét: ${feedbackMessage}`}
            style={[
              styles.feedbackOverlay,
              StyleSheet.absoluteFill,
              { backgroundColor: getOverlayBackgroundColor() },
            ]}
          >
            <Ionicons
              name={
                feedback === "VALID"
                  ? "checkmark-circle"
                  : feedback === "DUPLICATE"
                  ? "alert-circle"
                  : "close-circle"
              }
              size={80}
              color={colors.white}
            />
            <Text style={styles.feedbackTitle}>{feedbackMessage}</Text>
            {feedbackAttendee ? (
              <Text style={styles.feedbackSubtitle}>{feedbackAttendee}</Text>
            ) : null}
            <Text style={styles.tapToDismiss}>Chạm để quét tiếp ngay</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Floating Control Bar */}
      <Surface
        style={[styles.bottomControlBar, { paddingBottom: Math.max(insets.bottom, 16) }]}
        elevation={3}
      >
        <Button
          mode="elevated"
          icon="pencil-outline"
          onPress={() => setTestModalVisible(true)}
          style={styles.bottomBtn}
          contentStyle={{ height: 48 }}
        >
          Thử test mã
        </Button>
        <Button
          mode="contained"
          icon="sync"
          loading={isSyncing}
          disabled={isSyncing}
          onPress={handleSyncNow}
          style={styles.bottomBtn}
          contentStyle={{ height: 48 }}
        >
          Đồng bộ vé
        </Button>
      </Surface>

      {/* Manual / Simulation Modal */}
      <Modal
        visible={testModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTestModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Surface style={styles.modalCard} elevation={4}>
                <View style={styles.modalHeader}>
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    Thử nghiệm Quét mã
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTestModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng cửa sổ"
                    style={styles.standaloneIconBtn}
                  >
                    <Ionicons name="close" size={24} color={colors.black} />
                  </TouchableOpacity>
                </View>

                <Text variant="bodySmall" style={styles.modalHint}>
                  Dán chuỗi mã Dynamic QR hoặc nhập để kiểm tra phản hồi Xanh (Hợp lệ) / Vàng (Trùng vé) / Đỏ (Lỗi):
                </Text>

                <TextInput
                  value={manualToken}
                  onChangeText={setManualToken}
                  placeholder="Dán chuỗi mã QR token..."
                  mode="outlined"
                  outlineStyle={{ borderRadius: 16 }}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80, marginBottom: 16, backgroundColor: colors.surface }}
                />

                <View style={{ gap: 10 }}>
                  <Button
                    mode="contained"
                    onPress={() => {
                      if (!manualToken.trim()) return;
                      setTestModalVisible(false);
                      processScannedToken(manualToken.trim());
                      setManualToken("");
                    }}
                    style={{ borderRadius: m3Shapes.full }}
                  >
                    Xác thực mã đã dán
                  </Button>
                  <Button
                    mode="contained-tonal"
                    onPress={async () => {
                      try {
                        const res = await downloadCache("any");
                        Alert.alert("Thành công", `Đã lưu ${res.count} vé vào bộ nhớ đệm SQLite`);
                      } catch (e: any) {
                        Alert.alert("Lỗi", e.message);
                      }
                    }}
                    style={{ borderRadius: m3Shapes.full }}
                  >
                    Tải lại vé vào Cache Offline
                  </Button>
                </View>
              </Surface>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appbar: {
    backgroundColor: colors.surface,
  },
  appbarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  appbarSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  syncChip: {
    backgroundColor: colors.m3.primaryContainer,
    height: 32,
    marginRight: 4,
    borderRadius: m3Shapes.full,
  },
  syncChipText: {
    color: colors.m3.onPrimaryContainer,
    fontSize: 11,
    fontWeight: "700",
  },
  standaloneIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: m3Shapes.full,
  },
  statsHud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    color: colors.textSecondary,
    fontWeight: "700",
    marginBottom: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.neutralFill,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.black,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionBox: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    marginHorizontal: 30,
    padding: 28,
    alignItems: "center",
  },
  permissionTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 12,
  },
  permissionSubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
  },
  reticleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  reticleSquare: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: colors.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  reticleHint: {
    marginTop: 20,
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  feedbackOverlay: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    zIndex: 20,
  },
  feedbackTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.white,
    marginTop: 16,
    textAlign: "center",
  },
  feedbackSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.white,
    marginTop: 8,
    opacity: 0.9,
    textAlign: "center",
  },
  tapToDismiss: {
    fontSize: 13,
    color: colors.white,
    marginTop: 16,
    opacity: 0.8,
    fontWeight: "500",
  },
  bottomControlBar: {
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  bottomBtn: {
    flex: 1,
    borderRadius: m3Shapes.full,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalHint: {
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
});
