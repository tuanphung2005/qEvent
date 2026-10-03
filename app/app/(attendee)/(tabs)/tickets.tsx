import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Appbar,
  Card,
  Chip,
  Button,
  FAB,
} from "react-native-paper";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { colors, shadows, m3Shapes } from "../../../src/constants/theme";
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

  const checkedInCount = tickets.filter((t) => t.status === "CHECKED_IN").length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Material 3 Appbar Header */}
      <Appbar.Header elevated style={styles.appbar}>
        <Appbar.Content
          title="Vé sự kiện của tôi"
          titleStyle={styles.appbarTitle}
          subtitle={`Xin chào, ${user?.fullName || "Khách"}`}
          subtitleStyle={styles.appbarSubtitle}
        />
        <Appbar.Action
          icon="logout"
          color={colors.black}
          onPress={handleLogout}
          accessibilityLabel="Đăng xuất tài khoản"
        />
      </Appbar.Header>

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
            <Card mode="contained" style={[styles.statsCard, shadows.card]}>
              <Card.Content style={styles.statsCardContent}>
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
              </Card.Content>
            </Card>

            {/* M3 Tonal Action Button */}
            <Button
              mode="contained-tonal"
              icon="ticket-outline"
              loading={purchasing}
              disabled={purchasing}
              onPress={handlePurchaseSandbox}
              contentStyle={styles.purchaseBtnContent}
              style={styles.purchaseBtn}
            >
              {purchasing ? "Đang tạo vé..." : "+ Đăng ký / Nhận thêm vé (Sandbox)"}
            </Button>

            <Text style={styles.sectionTitle}>
              Danh sách vé sở hữu ({tickets.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Card mode="contained" style={[styles.emptyCard, shadows.card]}>
              <Card.Content style={styles.emptyCardContent}>
                <Ionicons name="ticket-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>
                  Bạn chưa có vé sự kiện nào
                </Text>
                <Button
                  mode="contained"
                  onPress={handlePurchaseSandbox}
                  style={styles.emptyActionBtn}
                >
                  Nhận vé mẫu trải nghiệm
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )
        }
        renderItem={({ item }) => {
          const isCheckedIn = item.status === "CHECKED_IN";
          const timeStr = item.checkedInAt
            ? new Date(item.checkedInAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          return (
            <Card
              mode="contained"
              onPress={() => router.push(`/(attendee)/ticket/${item.id}`)}
              style={[styles.ticketCard, shadows.card]}
            >
              <Card.Content style={styles.ticketContent}>
                <View style={styles.ticketHeader}>
                  <View style={styles.ticketTitleContainer}>
                    <Text style={styles.ticketEventName} numberOfLines={1}>
                      {item.event?.name || "Sự kiện Tech Summit 2026"}
                    </Text>
                    <Text style={styles.ticketTypeName}>
                      {item.ticketType?.name || "Standard Pass"}
                    </Text>
                  </View>

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
                    textStyle={[
                      styles.statusChipText,
                      {
                        color: isCheckedIn
                          ? colors.m3.onSuccessContainer
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {isCheckedIn
                      ? `ĐÃ ĐIỂM DANH ${timeStr ? `(${timeStr})` : ""}`
                      : "CHỜ ĐIỂM DANH"}
                  </Chip>
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
              </Card.Content>
            </Card>
          );
        }}
      />
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
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  appbarSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
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
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 0,
  },
  statsCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
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
    borderRadius: m3Shapes.full,
  },
  purchaseBtnContent: {
    height: 48,
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
    borderRadius: 24,
    borderWidth: 0,
  },
  emptyCardContent: {
    padding: 28,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  emptyActionBtn: {
    borderRadius: m3Shapes.full,
  },
  loaderContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 0,
  },
  ticketContent: {
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
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  ticketTypeName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 3,
  },
  statusChip: {
    borderRadius: m3Shapes.full,
    height: 28,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
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
