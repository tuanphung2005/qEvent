import React, { useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Center,
  Pressable,
  Input,
  InputField,
  Button,
  ButtonText,
  ButtonSpinner,
  Badge,
  BadgeText,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/api/client";
import { colors, shadows } from "../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const [email, setEmail] = useState("attendee@qcheck.com");
  const [password, setPassword] = useState("password123");
  const [currentUrl, setCurrentUrl] = useState(api.getBaseUrl());
  const [isCustomUrlOpen, setIsCustomUrlOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Lỗi", "Vui lòng nhập email và mật khẩu");
      return;
    }
    setLoading(true);
    try {
      console.log("[Login] Attempting auth for:", email, "against", api.getBaseUrl());
      const loggedUser = await login(email, password);
      console.log("[Login] Success! Logged user:", loggedUser);

      // Explicit navigation based on role
      if (loggedUser.role === "STAFF" || loggedUser.role === "ORGANIZER") {
        router.replace("/(staff)/scanner");
      } else {
        router.replace("/(attendee)/tickets");
      }
    } catch (err: any) {
      console.error("[Login] Failed:", err);
      Alert.alert(
        "Đăng nhập thất bại",
        `${err.message || "Không thể kết nối"}\n\nServer: ${api.getBaseUrl()}`
      );
    } finally {
      setLoading(false);
    }
  };

  const setTestAccount = (testEmail: string) => {
    setEmail(testEmail);
    setPassword("password123");
  };

  const switchApiUrl = (url: string) => {
    api.setBaseUrl(url);
    setCurrentUrl(url);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 24,
            flexGrow: 1,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Branding */}
          <VStack alignItems="center" mb="$6">
            <Center
              w={72}
              h={72}
              borderRadius={22}
              bg={colors.primaryLight}
              mb="$3"
            >
              <Ionicons name="qr-code" size={38} color={colors.primary} />
            </Center>
            <Heading size="2xl" color={colors.textPrimary} fontWeight="$bold">
              qCheck
            </Heading>
            <Text color={colors.textSecondary} fontSize="$sm" mt="$1">
              Soát vé sự kiện tức thời & Chống trùng lặp
            </Text>
          </VStack>

          {/* Gluestack Card Container */}
          <Box
            bg={colors.surface}
            borderRadius={20}
            p="$6"
            style={shadows.floating}
          >
            <Heading size="md" color={colors.textPrimary} mb="$4">
              Đăng nhập tài khoản
            </Heading>

            {/* Email Input using Gluestack Input */}
            <VStack mb="$3.5">
              <Text color={colors.textPrimary} fontWeight="$semibold" fontSize="$xs" mb="$1.5">
                EMAIL
              </Text>
              <Input
                size="md"
                variant="underlined"
                borderBottomWidth={0}
                borderRadius={12}
                bg="#F1F5F9"
                px="$3.5"
              >
                <InputField
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="nhap.email@example.com"
                  placeholderTextColor={colors.textMuted}
                  color={colors.textPrimary}
                  fontSize="$sm"
                />
              </Input>
            </VStack>

            {/* Password Input using Gluestack Input */}
            <VStack mb="$4">
              <Text color={colors.textPrimary} fontWeight="$semibold" fontSize="$xs" mb="$1.5">
                MẬT KHẨU
              </Text>
              <Input
                size="md"
                variant="underlined"
                borderBottomWidth={0}
                borderRadius={12}
                bg="#F1F5F9"
                px="$3.5"
              >
                <InputField
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  color={colors.textPrimary}
                  fontSize="$sm"
                />
              </Input>
            </VStack>

            {/* Gluestack Button */}
            <Button
              size="lg"
              borderRadius={12}
              bg={colors.primary}
              isDisabled={loading}
              onPress={handleLogin}
              sx={{
                ":active": { opacity: 0.85 },
              }}
            >
              {loading ? (
                <ButtonSpinner color="#FFFFFF" />
              ) : (
                <ButtonText color="#FFFFFF" fontWeight="$bold" fontSize="$md">
                  Đăng nhập
                </ButtonText>
              )}
            </Button>

            {/* Quick test accounts with Gluestack Pressable and Buttons */}
            <VStack mt="$6" pt="$4" borderTopWidth={1} borderColor="#F1F5F9">
              <Text color={colors.textMuted} fontSize="$2xs" fontWeight="$bold" mb="$2.5">
                CHỌN TÀI KHOẢN MẪU TEST:
              </Text>
              <HStack space="sm">
                <Box flex={1}>
                  <Button
                    size="sm"
                    variant="outline"
                    borderRadius={10}
                    borderWidth={0}
                    bg="#F1F5F9"
                    onPress={() => setTestAccount("attendee@qcheck.com")}
                  >
                    <ButtonText color={colors.textPrimary} fontSize="$xs" fontWeight="$semibold">
                      Khách tham dự
                    </ButtonText>
                  </Button>
                </Box>
                <Box flex={1}>
                  <Button
                    size="sm"
                    variant="outline"
                    borderRadius={10}
                    borderWidth={0}
                    bg="#F1F5F9"
                    onPress={() => setTestAccount("staff1@qcheck.com")}
                  >
                    <ButtonText color={colors.textPrimary} fontSize="$xs" fontWeight="$semibold">
                      Staff Soát vé
                    </ButtonText>
                  </Button>
                </Box>
              </HStack>
            </VStack>

            {/* API Connection Indicator */}
            <VStack mt="$4" pt="$3" borderTopWidth={1} borderColor="#F8FAFC" alignItems="center">
              <HStack space="xs" alignItems="center">
                <Ionicons name="server-outline" size={13} color={colors.textMuted} />
                <Text color={colors.textMuted} fontSize="$2xs">
                  API: {currentUrl}
                </Text>
                <Pressable onPress={() => setIsCustomUrlOpen(!isCustomUrlOpen)} ml="$1">
                  <Badge size="sm" action="info" variant="solid" borderRadius={6} px="$1.5" py="$0.5">
                    <BadgeText fontSize="$2xs">Đổi IP</BadgeText>
                  </Badge>
                </Pressable>
              </HStack>

              {isCustomUrlOpen && (
                <VStack w="100%" mt="$2" p="$2" bg="#F8FAFC" borderRadius={8}>
                  <Text color={colors.textSecondary} fontSize="$2xs" mb="$1">
                    Chọn nhanh địa chỉ Server:
                  </Text>
                  <HStack space="xs" flexWrap="wrap">
                    <Pressable
                      onPress={() => switchApiUrl("http://localhost:3000")}
                      px="$2"
                      py="$1"
                      bg="#E2E8F0"
                      borderRadius={6}
                      mb="$1"
                    >
                      <Text fontSize="$2xs">localhost:3000</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => switchApiUrl("http://10.0.2.2:3000")}
                      px="$2"
                      py="$1"
                      bg="#E2E8F0"
                      borderRadius={6}
                      mb="$1"
                    >
                      <Text fontSize="$2xs">10.0.2.2:3000 (Emulator)</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => switchApiUrl("http://192.168.99.39:3000")}
                      px="$2"
                      py="$1"
                      bg="#E2E8F0"
                      borderRadius={6}
                      mb="$1"
                    >
                      <Text fontSize="$2xs">192.168.99.39:3000 (LAN)</Text>
                    </Pressable>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
