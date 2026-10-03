import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
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
} from "react-native-paper";
import { useAuth } from "../../src/context/AuthContext";
import { useOfflineSync } from "../../src/context/OfflineSyncContext";
import { api } from "../../src/api/client";
import { hapticFeedback } from "../../src/services/haptics";
import { soundService } from "../../src/services/sound";
import { colors, shadows, m3Shapes } from "../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

type ScanFeedback = "IDLE" | "VALID" | "DUPLICATE" | "INVALID";

export default function ScannerScreen() {
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
    // Proactively download cache on start if online
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
      hapticFeedback.success(); // 1 light vibration
    } else if (type === "DUPLICATE") {
      hapticFeedback.duplicate(); // 2 vibrations
    } else if (type === "INVALID") {
      hapticFeedback.error(); // long vibration
    }

    // Reset scanner after 650ms for high gate throughput, or tap screen to dismiss instantly
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
        // Online verification
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
            // DUPLICATE CHECK-IN (Already checked in)
            triggerFeedback(
              "DUPLICATE",
              "VÉ ĐÃ QUÉT TRƯỚC ĐÓ",
              err.data?.ticket?.attendeeName || ""
            );
          } else {
            // If network fails midway, fallback to offline
            triggerFeedback("INVALID", err.message || "MÃ KHÔNG HỢP LỆ HOẶC HẾT HẠN");
          }
        }
      } else {
        // Offline-first verification
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

      {/* Live Check-in Attendance Progress Bar */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ĐÃ QUÉT:</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {stats.checkedIn} / {stats.total}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>CHƯA VÀO:</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.remaining} vé
            </Text>
          </View>
        </View>
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
          <Card mode="contained" style={styles.permissionBox}>
            <Card.Content style={{ alignItems: "center" }}>
              <Ionicons name="camera-outline" size={54} color={colors.textSecondary} />
              <Text style={styles.permissionTitle}>Cần quyền truy cập Camera</Text>
              <Text style={styles.permissionSubtitle}>
                Để quét mã Dynamic QR soát vé sự kiện
              </Text>
              <Button
                mode="contained"
                onPress={requestPermission}
                style={{ marginTop: 16 }}
              >
                Cấp quyền Camera
              </Button>
            </Card.Content>
          </Card>
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

        {/* Multi-sensory Fullscreen Color Flash Feedback Overlay */}
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
      <View style={[styles.bottomControlBar, shadows.floating, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          mode="elevated"
          icon="pencil-outline"
          onPress={() => setTestModalVisible(true)}
          style={{ flex: 1, borderRadius: m3Shapes.full }}
          contentStyle={{ height: 48 }}
        >
          Nhập / Thử test mã
        </Button>
        <Button
          mode="contained"
          icon="sync"
          loading={isSyncing}
          disabled={isSyncing}
          onPress={handleSyncNow}
          style={{ flex: 1, borderRadius: m3Shapes.full }}
          contentStyle={{ height: 48 }}
        >
          Đồng bộ vé
        </Button>
      </View>

      {/* Manual / Simulation Modal with KeyboardAvoidingView */}
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
              <Card mode="contained" style={styles.modalCard}>
                <Card.Content>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Thử nghiệm Quét mã</Text>
                    <TouchableOpacity
                      onPress={() => setTestModalVisible(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Đóng cửa sổ"
                      style={styles.standaloneIconBtn}
                    >
                      <Ionicons name="close" size={24} color={colors.black} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalHint}>
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
                    style={{ minHeight: 80, marginBottom: 16 }}
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
                </Card.Content>
              </Card>
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
    borderWidth: 0,
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
    backgroundColor: colors.primaryLight,
    height: 32,
    marginRight: 4,
  },
  syncChipText: {
    color: colors.primary,
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
  statsBar: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    borderWidth: 0,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
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
    borderRadius: 24,
    marginHorizontal: 30,
    borderWidth: 0,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 12,
  },
  permissionSubtitle: {
    fontSize: 14,
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
    borderWidth: 0,
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
    borderWidth: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
});
