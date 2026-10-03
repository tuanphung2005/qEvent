import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { Badge } from "../../../src/components/Badge";
import { Button } from "../../../src/components/Button";
import { colors, shadows, m3Shapes, m3Ripples } from "../../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function TicketsListScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await api.getMyTickets();
      if (res?.tickets) {
        setTickets(res.tickets);
      }
    } catch (err: any) {
      console.warn("Fetch tickets error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handlePurchaseSandbox = async () => {
    setPurchasing(true);
    try {
      const res = await api.purchaseTicketSandbox("", "", 1);
      Alert.alert(
        "Thành công",
        "Đã tạo 1 vé sự kiện mới! Bạn có thể xem mã Dynamic QR ngay.",
        [
          { text: "Đóng" },
          {
            text: "Xem vé ngay",
            onPress: () => {
              if (res?.tickets?.[0]?.id) {
                router.push(`/(attendee)/ticket/${res.tickets[0].id}`);
              }
            },
          },
        ]
      );
      fetchTickets();
    } catch (err: any) {
      Alert.alert("Lỗi tạo vé", err.message);
    } finally {
      setPurchasing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Xác nhận đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: logout },
      ]
    );
  };

  const renderBadge = (status: string, checkedInAt?: string) => {
    if (status === "CHECKED_IN") {
      const timeStr = checkedInAt
        ? new Date(checkedInAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      return (
        <Badge
          label={`ĐÃ ĐIỂM DANH ${timeStr ? `(${timeStr})` : ""}`}
          variant="success"
          icon={<Ionicons name="checkmark-circle" size={13} color={colors.m3.onSuccessContainer} />}
        />
      );
    }
    return (
      <Badge
        label="CHỜ ĐIỂM DANH"
        variant="neutral"
        icon={<Ionicons name="time-outline" size={13} color={colors.textSecondary} />}
      />
    );
  };

  const checkedInCount = tickets.filter((t) => t.status === "CHECKED_IN").length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top Header Bar - Standalone logout button: no background, black icon */}
      <View style={[styles.headerBar, shadows.subtle]}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Vé sự kiện của tôi</Text>
          <Text style={styles.headerSubtitle}>
            Xin chào, {user?.fullName || "Khách"}
          </Text>
        </View>

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất tài khoản"
          android_ripple={m3Ripples.borderlessDark}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.black} />
        </Pressable>
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTickets();
            }}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Quick Stats Banner - M3 Surface Container */}
            <View style={[styles.statsCard, shadows.card]}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>TỔNG SỐ VÉ</Text>
                <Text style={styles.statValue}>{tickets.length}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>ĐÃ ĐIỂM DANH</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {checkedInCount}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>CHƯA QUÉT</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {Math.max(0, tickets.length - checkedInCount)}
                </Text>
              </View>
            </View>

            <Button
              title={purchasing ? "Đang tạo vé..." : "+ Đăng ký / Nhận thêm vé sự kiện (Sandbox)"}
              variant="primary"
              loading={purchasing}
              onPress={handlePurchaseSandbox}
              icon={<Ionicons name="ticket-outline" size={18} color={colors.white} />}
              style={styles.purchaseBtn}
            />

            <Text style={styles.sectionTitle}>
              Danh sách vé sở hữu ({tickets.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={[styles.emptyCard, shadows.card]}>
              <Ionicons name="ticket-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                Bạn chưa có vé sự kiện nào
              </Text>
              <Button
                title="Nhận vé mẫu trải nghiệm"
                variant="secondary"
                onPress={handlePurchaseSandbox}
                style={styles.emptyActionBtn}
              />
            </View>
          ) : (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.ticketCardWrapper, shadows.card]}>
            <Pressable
              onPress={() => router.push(`/(attendee)/ticket/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Vé sự kiện ${item.event?.name || 'Sự kiện'}, nhấn để xem Dynamic QR`}
              android_ripple={m3Ripples.light}
              style={styles.ticketCardPressable}
            >
              <View style={styles.ticketHeader}>
                <View style={styles.ticketTitleContainer}>
                  <Text style={styles.ticketEventName} numberOfLines={1}>
                    {item.event?.name || "Sự kiện Tech Summit 2026"}
                  </Text>
                  <Text style={styles.ticketTypeName}>
                    {item.ticketType?.name || "Standard Pass"}
                  </Text>
                </View>
                {renderBadge(item.status, item.checkedInAt)}
              </View>

              <View style={styles.ticketFooter}>
                <View style={styles.venueRow}>
                  <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.venueText} numberOfLines={1}>
                    {item.event?.venue || "Trung tâm hội nghị"}
                  </Text>
                </View>
                <View style={styles.qrActionRow}>
                  <Ionicons name="qr-code-outline" size={15} color={colors.primary} />
                  <Text style={styles.qrActionText}>
                    Mở Dynamic QR
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        )}
      />
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: m3Shapes.full,
    borderWidth: 0,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  listHeader: {
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: colors.m3.surfaceContainerLowest,
    borderRadius: m3Shapes.lg,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 0,
  },
  statCol: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.neutralFill,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  purchaseBtn: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 4,
  },
  emptyCard: {
    backgroundColor: colors.m3.surfaceContainerLowest,
    borderRadius: m3Shapes.lg,
    padding: 28,
    alignItems: "center",
    borderWidth: 0,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  emptyActionBtn: {
    minWidth: 180,
  },
  loaderContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  ticketCardWrapper: {
    backgroundColor: colors.surface,
    borderRadius: m3Shapes.lg,
    marginBottom: 14,
    borderWidth: 0,
    overflow: "hidden",
  },
  ticketCardPressable: {
    padding: 16,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  ticketTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  ticketEventName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  ticketTypeName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 3,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  venueText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  qrActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  qrActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
});
