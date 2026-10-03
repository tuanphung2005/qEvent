import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Pressable,
  Center,
  Spinner,
  Badge,
  BadgeText,
  Button,
  ButtonText,
  ButtonIcon,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/api/client";
import { colors, shadows } from "../../src/constants/theme";
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

  const renderBadge = (status: string, checkedInAt?: string) => {
    if (status === "CHECKED_IN") {
      const timeStr = checkedInAt
        ? new Date(checkedInAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      return (
        <Badge action="success" variant="solid" borderRadius={20} px="$2.5" py="$1" borderWidth={0}>
          <HStack space="xs" alignItems="center">
            <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
            <BadgeText fontSize="$2xs" fontWeight="$bold">
              ĐÃ ĐIỂM DANH {timeStr ? `(${timeStr})` : ""}
            </BadgeText>
          </HStack>
        </Badge>
      );
    }
    return (
      <Badge action="info" variant="solid" borderRadius={20} px="$2.5" py="$1" borderWidth={0}>
        <HStack space="xs" alignItems="center">
          <Ionicons name="time-outline" size={12} color="#FFFFFF" />
          <BadgeText fontSize="$2xs" fontWeight="$bold">CHỜ ĐIỂM DANH</BadgeText>
        </HStack>
      </Badge>
    );
  };

  const checkedInCount = tickets.filter((t) => t.status === "CHECKED_IN").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      {/* Gluestack Top Header Bar */}
      <HStack
        bg={colors.surface}
        px="$5"
        py="$4"
        alignItems="center"
        justifyContent="space-between"
        style={shadows.subtle}
      >
        <VStack>
          <Heading size="md" color={colors.textPrimary}>
            Vé sự kiện của tôi
          </Heading>
          <Text color={colors.textSecondary} fontSize="$xs">
            Xin chào, {user?.fullName || "Khách"}
          </Text>
        </VStack>

        <HStack space="sm" alignItems="center">
          <Pressable
            onPress={logout}
            p="$2"
            borderRadius={10}
            bg="#F1F5F9"
            sx={{ ":active": { opacity: 0.7 } }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </HStack>
      </HStack>

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
          />
        }
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <VStack mb="$4">
            {/* Quick Stats Banner */}
            <Box
              bg={colors.surface}
              borderRadius={16}
              p="$4"
              mb="$4"
              style={shadows.card}
            >
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text color={colors.textMuted} fontSize="$xs" fontWeight="$bold">
                    TỔNG SỐ VÉ
                  </Text>
                  <Heading size="xl" color={colors.textPrimary}>
                    {tickets.length}
                  </Heading>
                </VStack>
                <Box w={1} h={36} bg="#F1F5F9" />
                <VStack>
                  <Text color={colors.textMuted} fontSize="$xs" fontWeight="$bold">
                    ĐÃ ĐIỂM DANH
                  </Text>
                  <Heading size="xl" color={colors.success}>
                    {checkedInCount}
                  </Heading>
                </VStack>
                <Box w={1} h={36} bg="#F1F5F9" />
                <VStack>
                  <Text color={colors.textMuted} fontSize="$xs" fontWeight="$bold">
                    CHƯA QUÉT
                  </Text>
                  <Heading size="xl" color={colors.primary}>
                    {Math.max(0, tickets.length - checkedInCount)}
                  </Heading>
                </VStack>
              </HStack>
            </Box>

            <Button
              size="md"
              bg={colors.primary}
              borderRadius={12}
              mb="$4"
              isDisabled={purchasing}
              onPress={handlePurchaseSandbox}
            >
              <ButtonIcon as={() => <Ionicons name="ticket-outline" size={18} color="#FFFFFF" />} mr="$2" />
              <ButtonText color="#FFFFFF" fontWeight="$bold" fontSize="$sm">
                {purchasing ? "Đang tạo vé..." : "+ Đăng ký / Nhận thêm vé sự kiện (Sandbox)"}
              </ButtonText>
            </Button>

            <Heading size="sm" color={colors.textPrimary}>
              Danh sách vé sở hữu ({tickets.length})
            </Heading>
          </VStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Box
              bg={colors.surface}
              borderRadius={16}
              p="$6"
              alignItems="center"
              style={shadows.card}
            >
              <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
              <Text color={colors.textSecondary} fontSize="$sm" mt="$2" mb="$3">
                Bạn chưa có vé sự kiện nào
              </Text>
              <Button
                size="sm"
                bg={colors.primary}
                borderRadius={10}
                onPress={handlePurchaseSandbox}
              >
                <ButtonText color="#FFFFFF" fontSize="$xs">Nhận vé mẫu trải nghiệm</ButtonText>
              </Button>
            </Box>
          ) : (
            <Center py="$8">
              <Spinner size="large" color={colors.primary} />
            </Center>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(attendee)/ticket/${item.id}`)}
            mb="$4"
            sx={{ ":active": { opacity: 0.9 } }}
          >
            <Box
              bg={colors.surface}
              borderRadius={16}
              p="$4"
              borderWidth={0}
              style={shadows.card}
            >
              <HStack justifyContent="space-between" alignItems="flex-start">
                <VStack flex={1} mr="$2">
                  <Heading size="sm" color={colors.textPrimary} numberOfLines={1}>
                    {item.event?.name || "Sự kiện Tech Summit 2026"}
                  </Heading>
                  <Text color={colors.primary} fontWeight="$semibold" fontSize="$xs" mt="$0.5">
                    {item.ticketType?.name || "Standard Pass"}
                  </Text>
                </VStack>
                {renderBadge(item.status, item.checkedInAt)}
              </HStack>

              <Box h={1} bg="#F1F5F9" my="$3" />

              <HStack justifyContent="space-between" alignItems="center">
                <HStack space="xs" alignItems="center" flex={1}>
                  <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                  <Text color={colors.textMuted} fontSize="$xs" numberOfLines={1}>
                    {item.event?.venue || "Trung tâm hội nghị"}
                  </Text>
                </HStack>
                <HStack space="xs" alignItems="center">
                  <Ionicons name="qr-code-outline" size={15} color={colors.primary} />
                  <Text color={colors.primary} fontWeight="$semibold" fontSize="$xs">
                    Mở Dynamic QR
                  </Text>
                </HStack>
              </HStack>
            </Box>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
