import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import {
  Appbar,
  Chip,
  ProgressBar,
  Text,
  useTheme,
  Surface,
} from "react-native-paper";
import { api } from "../../../src/api/client";
import { securityService } from "../../../src/services/security";
import { colors, m3Shapes } from "../../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function TicketDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ticketData, setTicketData] = useState<any>(null);
  const [qrToken, setQrToken] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  // Anti-screenshot protection
  useEffect(() => {
    securityService.enableScreenCaptureProtection();
    return () => {
      securityService.disableScreenCaptureProtection();
    };
  }, []);

  const loadTicketToken = async () => {
    if (!id) return;
    try {
      const res = await api.getTicketToken(id);
      setTicketData(res);
      setQrToken(res.qrToken);
      const remaining = res.expiresIn || 30;
      setSecondsLeft(remaining);
    } catch (err: any) {
      console.warn("Error fetching ticket QR token:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketToken();
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          loadTicketToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [id]);

  const isCheckedIn = ticketData?.status === "CHECKED_IN";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Material 3 Appbar Header */}
      <Appbar.Header mode="center-aligned" elevated style={styles.appbar}>
        <Appbar.BackAction
          color={colors.black}
          onPress={() => router.back()}
          accessibilityLabel="Quay lại danh sách vé"
        />
        <Appbar.Content
          title="Mã vé vào cổng"
          titleStyle={styles.appbarTitle}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 36) },
        ]}
      >
        {loading && !qrToken ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <View style={styles.passWrapper}>
            {/* Google Wallet Style Ticket Pass */}
            <Surface style={styles.passContainer} elevation={3}>
              {/* Event Header Stub */}
              <View
                style={[
                  styles.passHeaderStub,
                  {
                    backgroundColor: isCheckedIn
                      ? colors.m3.surfaceContainerHigh
                      : colors.m3.primaryContainer,
                  },
                ]}
              >
                <Text
                  variant="headlineSmall"
                  style={[
                    styles.eventName,
                    {
                      color: isCheckedIn
                        ? colors.textPrimary
                        : colors.m3.onPrimaryContainer,
                    },
                  ]}
                >
                  {ticketData?.event?.name || "Tech Summit Vietnam 2026"}
                </Text>

                <View style={styles.badgeRow}>
                  <Text
                    variant="labelLarge"
                    style={{
                      color: isCheckedIn
                        ? colors.textSecondary
                        : colors.primary,
                      fontWeight: "700",
                    }}
                  >
                    {ticketData?.ticketType?.name || "Standard Pass"}
                  </Text>
                  <Chip
                    compact
                    icon={isCheckedIn ? "check-circle" : "shield-check"}
                    style={{
                      backgroundColor: isCheckedIn
                        ? colors.m3.successContainer
                        : colors.surface,
                      borderRadius: m3Shapes.full,
                    }}
                    textStyle={{
                      color: isCheckedIn
                        ? colors.m3.onSuccessContainer
                        : colors.primary,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {isCheckedIn ? "ĐÃ CHECK-IN" : "HỢP LỆ"}
                  </Chip>
                </View>
              </View>

              {/* Perforated Ticket Notches */}
              <View style={styles.perforatedRow}>
                <View style={[styles.notch, styles.notchLeft]} />
                <View style={styles.dashedLine} />
                <View style={[styles.notch, styles.notchRight]} />
              </View>

              {/* Main Ticket Body */}
              <View style={styles.passBody}>
                {/* QR Code Container */}
                <Surface style={styles.qrSurface} elevation={1}>
                  {qrToken ? (
                    <QRCode
                      value={qrToken}
                      size={210}
                      color={colors.textPrimary}
                      backgroundColor={colors.white}
                    />
                  ) : (
                    <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                      Không có mã QR
                    </Text>
                  )}
                </Surface>

                {/* Dynamic Rotating Progress Indicator */}
                <View style={styles.countdownContainer}>
                  <View style={styles.countdownHeader}>
                    <View style={styles.countdownLabelRow}>
                      <Ionicons name="refresh-circle" size={18} color={theme.colors.primary} />
                      <Text variant="bodySmall" style={styles.countdownLabel}>
                        Mã Dynamic QR tự đổi sau:
                      </Text>
                    </View>
                    <Text variant="labelLarge" style={styles.countdownSeconds}>
                      {secondsLeft}s
                    </Text>
                  </View>

                  <ProgressBar
                    progress={secondsLeft / 30}
                    color={theme.colors.primary}
                    style={styles.progressBar}
                  />
                </View>

                {/* Metadata Details Surface */}
                <Surface style={styles.metadataSurface} elevation={0}>
                  <View style={styles.metaRow}>
                    <Text variant="bodySmall" style={styles.metaLabel}>Mã vé (ID):</Text>
                    <Text variant="labelMedium" style={styles.metaValue}>
                      {id ? `${id.slice(0, 14)}...` : ""}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text variant="bodySmall" style={styles.metaLabel}>Địa điểm:</Text>
                    <Text variant="labelMedium" style={[styles.metaValue, { fontWeight: "700" }]}>
                      {ticketData?.event?.venue || "Hội trường chính"}
                    </Text>
                  </View>

                  {isCheckedIn && ticketData?.checkedInAt && (
                    <View style={styles.metaRow}>
                      <Text variant="bodySmall" style={styles.metaLabel}>Thời gian check-in:</Text>
                      <Text variant="labelMedium" style={{ color: colors.success, fontWeight: "700" }}>
                        {new Date(ticketData.checkedInAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  )}
                </Surface>
              </View>
            </Surface>

            {/* M3 Security Protection Notice */}
            <Surface style={styles.securityNotice} elevation={0}>
              <Ionicons name="shield-checkmark" size={18} color={theme.colors.primary} />
              <Text variant="bodySmall" style={styles.securityText}>
                Bảo vệ chống chụp ảnh màn hình và sao chép vé đang kích hoạt.
              </Text>
            </Surface>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  scrollContent: {
    padding: 20,
    alignItems: "center",
  },
  loaderContainer: {
    marginTop: 48,
    alignItems: "center",
  },
  passWrapper: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  passContainer: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  passHeaderStub: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: "center",
  },
  eventName: {
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  perforatedRow: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    backgroundColor: colors.surface,
  },
  notch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.background,
    position: "absolute",
    top: 0,
    zIndex: 10,
  },
  notchLeft: {
    left: -9,
  },
  notchRight: {
    right: -9,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: colors.neutralDark,
    borderStyle: "dashed",
    marginHorizontal: 16,
  },
  passBody: {
    padding: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  qrSurface: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.white,
    marginBottom: 20,
  },
  countdownContainer: {
    width: "100%",
    marginBottom: 20,
  },
  countdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  countdownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countdownLabel: {
    color: colors.textSecondary,
    fontWeight: "500",
  },
  countdownSeconds: {
    color: colors.primary,
    fontWeight: "800",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutralFill,
  },
  metadataSurface: {
    width: "100%",
    gap: 10,
    backgroundColor: colors.m3.surfaceContainerLow,
    padding: 16,
    borderRadius: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    color: colors.textSecondary,
  },
  metaValue: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.m3.primaryContainer,
  },
  securityText: {
    color: colors.m3.onPrimaryContainer,
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
});
