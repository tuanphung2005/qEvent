import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Appbar,
  Card,
  Chip,
  Button,
} from "react-native-paper";
import { useOfflineSync } from "../../src/context/OfflineSyncContext";
import { offlineDb, OfflineScanLog } from "../../src/services/db";
import { colors, shadows, m3Shapes } from "../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function SyncStatusScreen() {
  const router = useRouter();
  const { isOnline, pendingCount, isSyncing, syncPendingQueue, downloadCache } = useOfflineSync();
  const [queue, setQueue] = useState<OfflineScanLog[]>([]);

  const loadQueue = async () => {
    const list = await offlineDb.getPendingScans();
    setQueue(list);
  };

  useEffect(() => {
    loadQueue();
  }, [pendingCount]);

  const handleSync = async () => {
    try {
      const res = await syncPendingQueue();
      Alert.alert(
        "Đồng bộ thành công",
        `Đã xử lý: ${res.processed} vé\nĐồng bộ thành công: ${res.synced}\nXung đột: ${res.conflicts}`
      );
      loadQueue();
    } catch (err: any) {
      Alert.alert("Lỗi", err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <Appbar.Header elevated style={styles.appbar}>
        <Appbar.BackAction
          color={colors.black}
          onPress={() => router.back()}
          accessibilityLabel="Quay lại"
        />
        <Appbar.Content
          title="Quản lý Đồng bộ vé"
          titleStyle={styles.appbarTitle}
          subtitle="Hàng đợi quét ngoại tuyến (Offline Queue)"
          subtitleStyle={styles.appbarSubtitle}
        />
      </Appbar.Header>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Card mode="contained" style={[styles.summaryCard, shadows.floating]}>
            <Card.Content>
              <View style={styles.statRow}>
                <View>
                  <Text style={styles.statNumber}>{pendingCount}</Text>
                  <Text style={styles.statLabel}>Vé đang chờ đồng bộ</Text>
                </View>
                <Chip
                  compact
                  icon={isOnline ? "wifi" : "wifi-off"}
                  style={{
                    backgroundColor: isOnline
                      ? colors.m3.successContainer
                      : colors.m3.warningContainer,
                  }}
                  textStyle={{
                    color: isOnline
                      ? colors.m3.onSuccessContainer
                      : colors.m3.onWarningContainer,
                    fontWeight: "700",
                  }}
                >
                  {isOnline ? "Trực tuyến (Online)" : "Ngoại tuyến (Offline)"}
                </Chip>
              </View>

              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  icon="sync"
                  loading={isSyncing}
                  disabled={!isOnline || pendingCount === 0}
                  onPress={handleSync}
                  style={styles.actionBtn}
                  contentStyle={{ height: 48 }}
                >
                  Đồng bộ ngay
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="download"
                  disabled={!isOnline}
                  onPress={async () => {
                    const res = await downloadCache("any");
                    Alert.alert("Thành công", `Đã cập nhật ${res.count} vé vào cache`);
                  }}
                  style={styles.actionBtn}
                  contentStyle={{ height: 48 }}
                >
                  Tải Cache
                </Button>
              </View>
            </Card.Content>
          </Card>
        }
        ListEmptyComponent={
          <Card mode="contained" style={[styles.emptyCard, shadows.card]}>
            <Card.Content style={{ alignItems: "center" }}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.success} />
              <Text style={styles.emptyTitle}>Hàng đợi trống</Text>
              <Text style={styles.emptySubtitle}>Tất cả các lượt quét đã được đồng bộ với máy chủ.</Text>
            </Card.Content>
          </Card>
        }
        renderItem={({ item }) => (
          <Card mode="contained" style={[styles.itemCard, shadows.card]}>
            <Card.Content>
              <View style={styles.itemRow}>
                <View>
                  <Text style={styles.itemTicketId}>Mã vé: {item.ticketId.slice(0, 16)}...</Text>
                  <Text style={styles.itemTime}>Thời gian quét: {item.scannedAt}</Text>
                </View>
                <Chip compact style={{ backgroundColor: colors.m3.warningContainer }}>
                  {item.syncStatus}
                </Chip>
              </View>
            </Card.Content>
          </Card>
        )}
      />
    </SafeAreaView>
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
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 0,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: m3Shapes.full,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginTop: 10,
    borderWidth: 0,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 0,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTicketId: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  itemTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
