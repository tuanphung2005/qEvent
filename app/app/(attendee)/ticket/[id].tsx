import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { api } from "../../../src/api/client";
import { securityService } from "../../../src/services/security";
import { Badge } from "../../../src/components/Badge";
import { colors, shadows, m3Shapes, m3Ripples } from "../../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ticketData, setTicketData] = useState<any>(null);
  const [qrToken, setQrToken] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(1)).current;

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

      // Reset animation
      progressAnim.setValue(remaining / 30);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: remaining * 1000,
        useNativeDriver: false,
      }).start();
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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const isCheckedIn = ticketData?.status === "CHECKED_IN";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top Header Bar - Standalone back button: no background, pure black icon */}
      <View style={[styles.headerBar, shadows.subtle]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách vé"
          android_ripple={m3Ripples.borderlessDark}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.headerTitle}>Mã vé</Text>
      </View>

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
          <View style={[styles.ticketDetailCard, shadows.floating]}>
            {/* Event Info */}
            <View style={styles.eventInfoContainer}>
              <Text style={styles.eventName}>
                {ticketData?.event?.name || "Tech Summit Vietnam 2026"}
              </Text>
              <View style={styles.badgeRow}>
                <Text style={styles.ticketTypeLabel}>
                  {ticketData?.ticketType?.name || "Standard Pass"}
                </Text>
                {isCheckedIn ? (
                  <Badge
                    label="ĐÃ CHECK-IN"
                    variant="success"
                    icon={<Ionicons name="checkmark-circle" size={12} color={colors.m3.onSuccessContainer} />}
                  />
                ) : (
                  <Badge
                    label="CHỜ SOÁT VÉ"
                    variant="neutral"
                    icon={<Ionicons name="time-outline" size={12} color={colors.textSecondary} />}
                  />
                )}
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

              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressWidth,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
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
  headerBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0,
  },
  backBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: m3Shapes.full,
    marginRight: 8,
    borderWidth: 0,
  },
  headerTitle: {
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
    borderRadius: m3Shapes.expressive,
    padding: 24,
    alignItems: "center",
    borderWidth: 0,
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
    marginBottom: 6,
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
  progressTrack: {
    height: 6,
    backgroundColor: colors.neutralFill,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  metadataCard: {
    width: "100%",
    gap: 8,
    backgroundColor: colors.m3.surfaceContainerLowest,
    padding: 14,
    borderRadius: m3Shapes.md,
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
