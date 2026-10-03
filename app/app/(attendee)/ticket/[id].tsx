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
      {/* Gluestack Header Bar - No background on back icon, pure black icon */}
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
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <VStack>
          <Heading size="md" color={colors.textPrimary}>
            Mã vé
          </Heading>
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
            <VStack alignItems="center" mb="$4">
              <Heading size="lg" color={colors.textPrimary} textAlign="center">
                {ticketData?.event?.name || "Tech Summit Vietnam 2026"}
              </Heading>
              <HStack space="xs" alignItems="center" mt="$1.5">
                <Text color={colors.primary} fontWeight="$bold" fontSize="$sm">
                  {ticketData?.ticketType?.name || "Standard Pass"}
                </Text>
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
                  size={220}
                  color={colors.textPrimary}
                  backgroundColor={colors.white}
                />
              ) : (
                <Text color={colors.textSecondary} fontSize="$sm">Không có mã QR</Text>
              )}
            </Box>

            {/* Dynamic Progress Indicator */}
            <VStack w="100%" mb="$5">
              <HStack justifyContent="space-between" alignItems="center" mb="$1.5">
                <Text color={colors.textSecondary} fontSize="$xs" fontWeight="$medium">
                  Làm mới sau:
                </Text>
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

            {/* Metadata Rows */}
            <VStack w="100%" space="sm" bg={colors.background} p="$3.5" borderRadius={16} borderWidth={0}>
              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize="$xs">Mã vé (ID):</Text>
                <Text color={colors.textPrimary} fontWeight="$bold" fontSize="$xs">
                  {id ? `${id.slice(0, 13)}...` : ""}
                </Text>
              </HStack>

              <HStack justifyContent="space-between" alignItems="center">
                <Text color={colors.textSecondary} fontSize="$xs">Địa điểm:</Text>
                <Text color={colors.textPrimary} fontWeight="$semibold" fontSize="$xs">
                  {ticketData?.event?.venue || "Hội trường chính"}
                </Text>
              </HStack>

              {isCheckedIn && ticketData?.checkedInAt && (
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={colors.textSecondary} fontSize="$xs">Thời gian check-in:</Text>
                  <Text color={colors.success} fontWeight="$semibold" fontSize="$xs">
                    {new Date(ticketData.checkedInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </HStack>
              )}
            </VStack>
          </Box>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
