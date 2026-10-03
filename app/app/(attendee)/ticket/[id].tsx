import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import {
  Appbar,
  Card,
  Chip,
  ProgressBar,
} from "react-native-paper";
import { api } from "../../../src/api/client";
import { securityService } from "../../../src/services/security";
import { colors, shadows, m3Shapes } from "../../../src/constants/theme";

export default function TicketDetailScreen() {
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
      <Appbar.Header elevated style={styles.appbar}>
        <Appbar.BackAction
          color={colors.black}
          onPress={() => router.back()}
          accessibilityLabel="Quay lại danh sách vé"
        />
        <Appbar.Content
          title="Chi tiết mã vé"
          titleStyle={styles.appbarTitle}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
        ]}
      >
        {loading && !qrToken ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <Card
            mode="contained"
            style={[styles.ticketDetailCard, shadows.floating]}
          >
            <Card.Content style={styles.cardContent}>
              {/* Event Info */}
              <View style={styles.eventInfoContainer}>
                <Text style={styles.eventName}>
                  {ticketData?.event?.name || "Tech Summit Vietnam 2026"}
                </Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.ticketTypeLabel}>
                    {ticketData?.ticketType?.name || "Standard Pass"}
                  </Text>
                  <Chip
                    compact
                    icon={isCheckedIn ? "check-circle" : "clock-outline"}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: isCheckedIn
                          ? colors.m3.successContainer
                          : colors.m3.surfaceContainer,
                      },
                    ]}
                    textStyle={{
                      color: isCheckedIn
                        ? colors.m3.onSuccessContainer
                        : colors.textSecondary,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {isCheckedIn ? "ĐÃ CHECK-IN" : "CHỜ SOÁT VÉ"}
                  </Chip>
                </View>
              </View>

              {/* QR Code Container */}
              <View style={[styles.qrWrapper, shadows.card]}>
                {qrToken ? (
                  <QRCode
                    value={qrToken}
                    size={220}
                    color={colors.textPrimary}
                    backgroundColor={colors.white}
                  />
                ) : (
                  <Text style={styles.noQrText}>Không có mã QR</Text>
                )}
              </View>

              {/* Dynamic Progress Indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Làm mới sau:</Text>
                  <Text style={styles.progressSeconds}>{secondsLeft}s</Text>
                </View>

                <ProgressBar
                  progress={secondsLeft / 30}
                  color={colors.primary}
                  style={styles.progressBar}
                />
              </View>

              {/* Metadata Rows */}
              <View style={styles.metadataCard}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Mã vé (ID):</Text>
                  <Text style={styles.metaValue}>
                    {id ? `${id.slice(0, 13)}...` : ""}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Địa điểm:</Text>
                  <Text style={[styles.metaValue, { fontWeight: "600" }]}>
                    {ticketData?.event?.venue || "Hội trường chính"}
                  </Text>
                </View>

                {isCheckedIn && ticketData?.checkedInAt && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Thời gian check-in:</Text>
                    <Text style={[styles.metaValue, { color: colors.success, fontWeight: "600" }]}>
                      {new Date(ticketData.checkedInAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
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
    borderWidth: 0,
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
    marginTop: 40,
    alignItems: "center",
  },
  ticketDetailCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 0,
  },
  cardContent: {
    padding: 20,
    alignItems: "center",
  },
  eventInfoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  eventName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 26,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  ticketTypeLabel: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  statusChip: {
    borderRadius: m3Shapes.full,
    height: 28,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 0,
  },
  noQrText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  progressContainer: {
    width: "100%",
    marginBottom: 20,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  progressSeconds: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutralFill,
  },
  metadataCard: {
    width: "100%",
    gap: 8,
    backgroundColor: colors.m3.surfaceContainerLowest,
    padding: 14,
    borderRadius: 16,
    borderWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
