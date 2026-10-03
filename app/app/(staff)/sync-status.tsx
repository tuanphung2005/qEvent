import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useOfflineSync } from "../../src/context/OfflineSyncContext";
import { offlineDb, OfflineScanLog } from "../../src/services/db";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { Header } from "../../src/components/Header";
import { colors } from "../../src/constants/theme";
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
    <View style={styles.container}>
      <Header
        title="Quản lý Đồng bộ vé"
        subtitle="Hàng đợi quét ngoại tuyến (Offline Queue)"
        onBack={() => router.back()}
      />

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Card variant="floating" style={styles.summaryCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statNumber}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Vé đang chờ đồng bộ</Text>
              </View>
              <Badge
                label={isOnline ? "Trực tuyến (Online)" : "Ngoại tuyến (Offline)"}
                variant={isOnline ? "success" : "warning"}
              />
            </View>

            <View style={styles.actionsRow}>
              <Button
                title="Đồng bộ ngay"
                variant="primary"
                loading={isSyncing}
                disabled={!isOnline || pendingCount === 0}
                onPress={handleSync}
                style={{ flex: 1 }}
              />
              <Button
                title="Tải Cache"
                variant="secondary"
                disabled={!isOnline}
                onPress={async () => {
                  const res = await downloadCache("any");
                  Alert.alert("Thành công", `Đã cập nhật ${res.count} vé vào cache`);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        }
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.success} />
            <Text style={styles.emptyTitle}>Hàng đợi trống</Text>
            <Text style={styles.emptySubtitle}>Tất cả các lượt quét đã được đồng bộ với máy chủ.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card variant="card" style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View>
                <Text style={styles.itemTicketId}>Mã vé: {item.ticketId.slice(0, 16)}...</Text>
                <Text style={styles.itemTime}>Thời gian quét: {item.scannedAt}</Text>
              </View>
              <Badge label={item.syncStatus} variant="warning" />
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  summaryCard: {
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
  emptyCard: {
    alignItems: "center",
    padding: 30,
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
