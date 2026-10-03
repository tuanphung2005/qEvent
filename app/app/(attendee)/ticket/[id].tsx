import React, { useEffect, useState, useRef } from "react";
import {
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Center,
  Spinner,
  Badge,
  BadgeText,
  Pressable,
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { api } from "../../../src/api/client";
import { securityService } from "../../../src/services/security";
import { colors, shadows } from "../../../src/constants/theme";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      {/* Gluestack Header Bar */}
      <HStack
        bg={colors.surface}
        px="$5"
        py="$3"
        alignItems="center"
        style={shadows.subtle}
      >
        <Pressable
          onPress={() => router.back()}
          mr="$2"
          borderRadius={12}
          bg={colors.neutralFill}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách vé"
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
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <VStack>
          <Heading size="md" color={colors.textPrimary}>
            Mã vé & Điểm danh
          </Heading>
          <Text color={colors.textSecondary} fontSize="$xs">
            Dynamic QR xoay mã 30s chống giả mạo
          </Text>
        </VStack>
      </HStack>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Math.max(insets.bottom + 20, 32),
          alignItems: "center",
        }}
      >
        {loading && !qrToken ? (
          <Center mt="$10">
            <Spinner size="large" color={colors.primary} />
          </Center>
        ) : (
          <Box
            w="100%"
            bg={colors.surface}
            borderRadius={24}
            p="$6"
            alignItems="center"
            borderWidth={0}
            style={shadows.floating}
          >
            {/* Event Info */}
            <VStack alignItems="center" mb="$3">
              <Heading size="lg" color={colors.textPrimary} textAlign="center">
                {ticketData?.event?.name || "Tech Summit Vietnam 2026"}
              </Heading>
              <Text color={colors.primary} fontWeight="$bold" fontSize="$sm" mt="$1">
                {ticketData?.ticketType?.name || "Standard Pass"}
              </Text>
            </VStack>

            {/* Attendance Status Banner */}
            {isCheckedIn ? (
              <Box
                w="100%"
                bg={colors.successLight}
                p="$3.5"
                borderRadius={16}
                mb="$4"
                alignItems="center"
                borderWidth={0}
              >
                <HStack space="xs" alignItems="center" mb="$1">
                  <Ionicons name="checkmark-done-circle" size={20} color={colors.success} />
                  <Heading size="xs" color={colors.success}>
                    ĐÃ ĐIỂM DANH THÀNH CÔNG
                  </Heading>
                </HStack>
                <Text color={colors.success} fontSize="$2xs" textAlign="center">
                  Thời gian: {ticketData?.checkedInAt ? new Date(ticketData.checkedInAt).toLocaleString("vi-VN") : "Hôm nay"}
                </Text>
                <Text color={colors.success} fontSize="$2xs" textAlign="center" mt="$0.5">
                  Vé đã được xác thực tại cổng sự kiện.
                </Text>
              </Box>
            ) : (
              <Box
                w="100%"
                bg={colors.primaryLight}
                p="$3"
                borderRadius={16}
                mb="$4"
                alignItems="center"
                borderWidth={0}
              >
                <HStack space="xs" alignItems="center" mb="$1">
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                  <Heading size="xs" color={colors.primary}>
                    SẴN SÀNG ĐIỂM DANH TẠI CỔNG
                  </Heading>
                </HStack>
                <Text color={colors.primary} fontSize="$2xs" textAlign="center">
                  Xuất trình mã QR bên dưới cho nhân viên soát vé khi vào hội trường
                </Text>
              </Box>
            )}

            {/* Anti-screenshot indicator */}
            <HStack
              space="xs"
              alignItems="center"
              bg={colors.neutralFill}
              px="$3"
              py="$1.5"
              borderRadius={20}
              mb="$4"
              borderWidth={0}
            >
              <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} />
              <Text color={colors.textSecondary} fontSize="$2xs" fontWeight="$semibold">
                Bảo vệ chống chụp / quay lén màn hình
              </Text>
            </HStack>

            {/* QR Code Container */}
            <Box
              p="$4"
              bg={colors.white}
              borderRadius={20}
              mb="$4"
              borderWidth={0}
              style={shadows.card}
            >
              {qrToken ? (
                <QRCode
                  value={qrToken}
                  size={210}
                  color={colors.textPrimary}
                  backgroundColor={colors.white}
                />
              ) : (
                <Text color={colors.textMuted} fontSize="$sm">Không có mã QR</Text>
              )}
            </Box>

            {/* Dynamic Progress Indicator */}
            <VStack w="100%" mb="$5">
              <HStack justifyContent="space-between" alignItems="center" mb="$1.5">
                <HStack space="xs" alignItems="center" bg={colors.primaryLight} px="$2.5" py="$1" borderRadius={12}>
                  <Ionicons name="timer-outline" size={14} color={colors.primary} />
                  <Text color={colors.primary} fontSize="$2xs" fontWeight="$bold">
                    Tự làm mới mã sau:
                  </Text>
                </HStack>
                <Text color={colors.primary} fontWeight="$bold" fontSize="$sm">
                  {secondsLeft}s
                </Text>
              </HStack>

              <Box h={6} bg={colors.neutralFill} borderRadius={3} overflow="hidden">
                <Animated.View
                  style={{
                    height: "100%",
                    backgroundColor: colors.primary,
                    borderRadius: 3,
                    width: progressWidth,
                  }}
                />
              </Box>
            </VStack>

            {/* Metadata Rows - Clean borderless tonal grouping */}
            <VStack w="100%" space="sm" pt="$3" bg={colors.background} p="$3.5" borderRadius={16} borderWidth={0}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textMuted} fontSize="$xs">Mã vé (ID):</Text>
                <Text color={colors.textPrimary} fontWeight="$bold" fontSize="$xs">
                  {id ? `${id.slice(0, 13)}...` : ""}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textMuted} fontSize="$xs">Địa điểm:</Text>
                <Text color={colors.textPrimary} fontWeight="$semibold" fontSize="$xs">
                  {ticketData?.event?.venue || "Hội trường chính"}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textMuted} fontSize="$xs">Trạng thái:</Text>
                {isCheckedIn ? (
                  <Badge action="success" variant="solid" borderRadius={12} px="$2" py="$0.5" borderWidth={0}>
                    <BadgeText fontSize="$2xs" fontWeight="$bold">ĐÃ CHECK-IN</BadgeText>
                  </Badge>
                ) : (
                  <Badge action="info" variant="solid" borderRadius={12} px="$2" py="$0.5" borderWidth={0}>
                    <BadgeText fontSize="$2xs" fontWeight="$bold">CHỜ SOÁT VÉ</BadgeText>
                  </Badge>
                )}
              </HStack>
            </VStack>
          </Box>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
