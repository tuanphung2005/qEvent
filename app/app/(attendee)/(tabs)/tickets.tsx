import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Appbar,
  Card,
  Chip,
  Button,
  FAB,
  Text,
  useTheme,
  Surface,
} from "react-native-paper";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/api/client";
import { colors, m3Shapes } from "../../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

type TicketFilter = "ALL" | "PENDING" | "CHECKED_IN";

export default function TicketsListScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState<TicketFilter>("ALL");
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
  const pendingCount = Math.max(0, tickets.length - checkedInCount);

  const filteredTickets = tickets.filter((t) => {
    if (filter === "CHECKED_IN") return t.status === "CHECKED_IN";
    if (filter === "PENDING") return t.status !== "CHECKED_IN";
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Material 3 Appbar Header */}
      <Appbar.Header mode="center-aligned" elevated style={styles.appbar}>
        <Appbar.Content
          title="Ví vé sự kiện"
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
        data={filteredTickets}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchTickets();
            }}
            colors={[theme.colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Interactive Material 3 Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersScroll}
            >
              <Chip
                selected={filter === "ALL"}
                showSelectedCheck
                mode={filter === "ALL" ? "flat" : "outlined"}
                onPress={() => setFilter("ALL")}
                style={styles.filterChip}
              >
                Tất cả ({tickets.length})
              </Chip>
              <Chip
                selected={filter === "PENDING"}
                showSelectedCheck
                mode={filter === "PENDING" ? "flat" : "outlined"}
                onPress={() => setFilter("PENDING")}
                style={styles.filterChip}
              >
                Chưa quét ({pendingCount})
              </Chip>
              <Chip
                selected={filter === "CHECKED_IN"}
                showSelectedCheck
                mode={filter === "CHECKED_IN" ? "flat" : "outlined"}
                onPress={() => setFilter("CHECKED_IN")}
                style={styles.filterChip}
              >
                Đã vào cổng ({checkedInCount})
              </Chip>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Surface style={styles.emptySurface} elevation={1}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="ticket-outline" size={44} color={theme.colors.primary} />
              </View>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                Không có vé nào trong danh mục
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtitle}>
                Nhấn nút bên dưới để nhận ngay 1 vé sự kiện mẫu thử nghiệm.
              </Text>
              <Button
                mode="contained"
                icon="plus"
                loading={purchasing}
                onPress={handlePurchaseSandbox}
                style={styles.emptyBtn}
              >
                Nhận vé mẫu thử nghiệm
              </Button>
            </Surface>
          ) : (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
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
            <Surface style={styles.walletPassCard} elevation={2}>
              {/* Top Banner Stub */}
              <View
                style={[
                  styles.passTopStub,
                  {
                    backgroundColor: isCheckedIn
                      ? colors.m3.surfaceContainerHigh
                      : colors.m3.primaryContainer,
                  },
                ]}
              >
                <View style={styles.passTitleCol}>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.passEventName,
                      {
                        color: isCheckedIn
                          ? colors.textPrimary
                          : colors.m3.onPrimaryContainer,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.event?.name || "Tech Summit 2026"}
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={[
                      styles.passTypeLabel,
                      {
                        color: isCheckedIn
                          ? colors.textSecondary
                          : colors.primary,
                      },
                    ]}
                  >
                    {item.ticketType?.name || "Standard Pass"}
                  </Text>
                </View>

                <Chip
                  compact
                  icon={isCheckedIn ? "check-circle" : "clock-outline"}
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

              {/* Perforated Divider */}
              <View style={styles.perforatedRow}>
                <View style={[styles.notch, styles.notchLeft]} />
                <View style={styles.dashedLine} />
                <View style={[styles.notch, styles.notchRight]} />
              </View>

              {/* Bottom Body */}
              <View style={styles.passBody}>
                <View style={styles.passDetailsRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text variant="bodySmall" style={styles.detailText} numberOfLines={1}>
                      {item.event?.venue || "Trung tâm hội nghị Quốc Gia"}
                    </Text>
                  </View>
                  {isCheckedIn && timeStr && (
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color={colors.success} />
                      <Text variant="bodySmall" style={{ color: colors.success, fontWeight: "600" }}>
                        Vào lúc: {timeStr}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Primary Action Button */}
                <Button
                  mode={isCheckedIn ? "outlined" : "contained"}
                  icon="qrcode-scan"
                  onPress={() => router.push(`/(attendee)/ticket/${item.id}`)}
                  style={styles.openQrBtn}
                  contentStyle={styles.openQrBtnContent}
                >
                  {isCheckedIn ? "Xem lại mã QR" : "Mở mã Dynamic QR"}
                </Button>
              </View>
            </Surface>
          );
        }}
      />

      {/* Material 3 Floating Action Button */}
      <FAB
        icon="plus"
        label="Thêm vé test"
        loading={purchasing}
        onPress={handlePurchaseSandbox}
        style={styles.fab}
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
    padding: 16,
    paddingBottom: 96,
  },
  listHeader: {
    marginBottom: 16,
  },
  filtersScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    borderRadius: m3Shapes.full,
  },
  walletPassCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    marginBottom: 16,
    overflow: "hidden",
  },
  passTopStub: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passTitleCol: {
    flex: 1,
    marginRight: 12,
  },
  passEventName: {
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  passTypeLabel: {
    fontWeight: "700",
    marginTop: 2,
  },
  perforatedRow: {
    height: 16,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    backgroundColor: colors.surface,
  },
  notch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    position: "absolute",
    top: 0,
    zIndex: 10,
  },
  notchLeft: {
    left: -8,
  },
  notchRight: {
    right: -8,
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
    padding: 20,
    paddingTop: 8,
    backgroundColor: colors.surface,
  },
  passDetailsRow: {
    marginBottom: 16,
    gap: 6,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    color: colors.textSecondary,
  },
  openQrBtn: {
    borderRadius: m3Shapes.full,
  },
  openQrBtnContent: {
    height: 48,
  },
  emptySurface: {
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    backgroundColor: colors.surface,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.m3.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyBtn: {
    borderRadius: m3Shapes.full,
  },
  loaderContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    borderRadius: m3Shapes.full,
    backgroundColor: colors.m3.primaryContainer,
  },
});
