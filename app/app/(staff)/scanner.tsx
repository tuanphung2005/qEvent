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
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Pressable,
} from "@gluestack-ui/themed";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useOfflineSync } from "../../src/context/OfflineSyncContext";
import { api } from "../../src/api/client";
import { hapticFeedback } from "../../src/services/haptics";
import { soundService } from "../../src/services/sound";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { colors, shadows } from "../../src/constants/theme";
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
        // Parse token if needed to get ticketId
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
        return colors.success; // Emerald green
      case "DUPLICATE":
        return colors.warning; // Amber
      case "INVALID":
        return colors.error; // Red
      default:
        return "transparent";
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Staff Navigation & Info Bar */}
      <HStack
        bg={colors.surface}
        px="$4"
        pb="$3"
        pt={Math.max(insets.top, 14)}
        justifyContent="space-between"
        alignItems="center"
        style={shadows.floating}
      >
        <VStack>
          <Heading size="md" color={colors.textPrimary}>
            qCheck Scanner
          </Heading>
          <HStack space="xs" alignItems="center" mt="$1">
            <Box
              w={8}
              h={8}
              borderRadius={4}
              bg={isOnline ? colors.success : colors.warning}
            />
            <Text color={colors.textSecondary} fontSize="$xs">
              {isOnline ? "Online Server" : "Chế độ Ngoại Tuyến (Offline)"}
            </Text>
          </HStack>
        </VStack>

        <HStack space="sm" alignItems="center">
          {/* Torch toggle button - Standalone icon: no background, pure black icon */}
          <Pressable
            onPress={() => setTorch(!torch)}
            p="$2"
            borderRadius={12}
            accessibilityRole="button"
            accessibilityLabel={torch ? "Tắt đèn pin" : "Bật đèn pin"}
            sx={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              ":active": { opacity: 0.7 },
            }}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={torch ? "flashlight" : "flashlight-outline"}
              size={22}
              color={colors.black}
            />
          </Pressable>

          {/* Sync Queue Badge Button - Paired icon + text with primaryLight badge fill */}
          <Pressable
            onPress={() => router.push("/(staff)/sync-status")}
            bg={colors.primaryLight}
            px="$3"
            py="$2"
            borderRadius={12}
            accessibilityRole="button"
            accessibilityLabel={`Hàng đợi đồng bộ: ${pendingCount} vé đang chờ`}
            sx={{
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              ":active": { opacity: 0.8 },
            }}
            style={{
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HStack space="xs" alignItems="center">
              <Ionicons name="cloud-upload" size={16} color={colors.primary} />
              <Text color={colors.primary} fontSize="$xs" fontWeight="$bold">
                {pendingCount} chờ sync
              </Text>
            </HStack>
          </Pressable>

          {/* Logout with Confirmation Dialog - Standalone icon: no background, pure black icon */}
          <Pressable
            onPress={handleLogout}
            p="$2"
            borderRadius={12}
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất tài khoản"
            sx={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              ":active": { opacity: 0.7 },
            }}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.black} />
          </Pressable>
        </HStack>
      </HStack>

      {/* Live Check-in Attendance Progress Bar - Clean borderless */}
      {stats && (
        <HStack
          bg={colors.background}
          px="$4"
          py="$2.5"
          justifyContent="space-around"
        >
          <HStack space="xs" alignItems="center">
            <Text color={colors.textSecondary} fontSize="$2xs" fontWeight="$bold">
              ĐÃ QUÉT:
            </Text>
            <Text color={colors.success} fontSize="$xs" fontWeight="$bold">
              {stats.checkedIn} / {stats.total}
            </Text>
          </HStack>
          <HStack space="xs" alignItems="center">
            <Text color={colors.textSecondary} fontSize="$2xs" fontWeight="$bold">
              CHƯA VÀO:
            </Text>
            <Text color={colors.primary} fontSize="$xs" fontWeight="$bold">
              {stats.remaining} vé
            </Text>
          </HStack>
        </HStack>
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
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={54} color={colors.textSecondary} />
            <Text style={styles.permissionTitle}>Cần quyền truy cập Camera</Text>
            <Text style={styles.permissionSubtitle}>
              Để quét mã Dynamic QR soát vé sự kiện
            </Text>
            <Button
              title="Cấp quyền Camera"
              onPress={requestPermission}
              style={{ marginTop: 16 }}
            />
          </View>
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

        {/* Multi-sensory Fullscreen Color Flash Feedback Overlay (Tap to dismiss immediately) */}
        {feedback !== "IDLE" && (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={dismissFeedbackImmediately}
            accessibilityLiveRegion="assertive"
            accessibilityLabel={`Kết quả quét: ${feedbackMessage}`}
            style={[
              styles.feedbackOverlay,
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
          title="Nhập / Thử test mã"
          variant="secondary"
          onPress={() => setTestModalVisible(true)}
          icon={<Ionicons name="create-outline" size={18} color={colors.textPrimary} />}
          style={{ flex: 1, minHeight: 48 }}
        />
        <Button
          title="Đồng bộ vé"
          variant="primary"
          loading={isSyncing}
          onPress={handleSyncNow}
          icon={<Ionicons name="sync" size={18} color={colors.white} />}
          style={{ flex: 1, minHeight: 48 }}
        />
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
              <Card variant="floating" style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Thử nghiệm Quét mã</Text>
                  {/* Standalone close button: no background, black icon */}
                  <TouchableOpacity
                    onPress={() => setTestModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng cửa sổ"
                    style={{
                      minWidth: 48,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={24} color={colors.black} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalHint}>
                  Dán chuỗi mã Dynamic QR hoặc nhập để kiểm tra phản hồi Xanh (Hợp lệ) / Vàng (Trùng vé) / Đỏ (Lỗi):
                </Text>

                <Input
                  value={manualToken}
                  onChangeText={setManualToken}
                  placeholder="Dán chuỗi mã QR token..."
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80 }}
                />

                <View style={{ gap: 10, marginTop: 10 }}>
                  <Button
                    title="Xác thực mã đã dán"
                    variant="primary"
                    onPress={() => {
                      if (!manualToken.trim()) return;
                      setTestModalVisible(false);
                      processScannedToken(manualToken.trim());
                      setManualToken("");
                    }}
                  />
                  <Button
                    title="Tải lại vé vào Cache Offline"
                    variant="secondary"
                    onPress={async () => {
                      try {
                        const res = await downloadCache("any");
                        Alert.alert("Thành công", `Đã lưu ${res.count} vé vào bộ nhớ đệm SQLite`);
                      } catch (e: any) {
                        Alert.alert("Lỗi", e.message);
                      }
                    }}
                  />
                </View>
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
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.black,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionBox: {
    backgroundColor: colors.surface,
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
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
    ...StyleSheet.absoluteFill,
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
    borderRadius: 20,
    padding: 20,
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
