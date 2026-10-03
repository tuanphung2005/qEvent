import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/api/client";
import { colors, shadows, m3Shapes, m3Ripples } from "../../src/constants/theme";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { Badge } from "../../src/components/Badge";
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Branding - Standalone QR code logo: no background box, pure black */}
          <View style={styles.logoSection}>
            <View style={styles.logoWrapper}>
              <Ionicons name="qr-code" size={48} color={colors.black} />
            </View>
            <Text style={styles.brandTitle}>qCheck</Text>
            <Text style={styles.brandSubtitle}>
              Soát vé sự kiện tức thời & Chống trùng lặp
            </Text>
          </View>

          {/* M3 Expressive Card Container */}
          <View style={[styles.loginCard, shadows.floating]}>
            <Text style={styles.cardHeading}>Đăng nhập tài khoản</Text>

            {/* Email Field */}
            <Input
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="nhap.email@example.com"
            />

            {/* Password Field */}
            <Input
              label="MẬT KHẨU"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />

            {/* Login Action Button */}
            <Button
              title="Đăng nhập"
              variant="primary"
              loading={loading}
              onPress={handleLogin}
              style={styles.loginBtn}
            />

            {/* Quick Test Accounts */}
            <View style={styles.testSection}>
              <Text style={styles.testSectionHeading}>CHỌN TÀI KHOẢN MẪU TEST:</Text>
              <View style={styles.testButtonsRow}>
                <Pressable
                  onPress={() => setTestAccount("attendee@qcheck.com")}
                  android_ripple={m3Ripples.dark}
                  accessibilityRole="button"
                  accessibilityLabel="Tài khoản khách tham dự"
                  style={({ pressed }) => [
                    styles.testChip,
                    { opacity: Platform.OS === "ios" && pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.testChipText}>Khách tham dự</Text>
                </Pressable>

                <Pressable
                  onPress={() => setTestAccount("staff1@qcheck.com")}
                  android_ripple={m3Ripples.dark}
                  accessibilityRole="button"
                  accessibilityLabel="Tài khoản nhân viên soát vé"
                  style={({ pressed }) => [
                    styles.testChip,
                    { opacity: Platform.OS === "ios" && pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.testChipText}>Staff Soát vé</Text>
                </Pressable>
              </View>
            </View>

            {/* API Connection Indicator */}
            <View style={styles.apiSection}>
              <View style={styles.apiIndicatorRow}>
                <Ionicons name="server-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.apiText}>API: {currentUrl}</Text>
                <Pressable
                  onPress={() => setIsCustomUrlOpen(!isCustomUrlOpen)}
                  android_ripple={m3Ripples.dark}
                  accessibilityRole="button"
                  accessibilityLabel="Đổi địa chỉ IP máy chủ"
                >
                  <Badge label="Đổi IP" variant="info" />
                </Pressable>
              </View>

              {isCustomUrlOpen && (
                <View style={styles.serverPickerBox}>
                  <Text style={styles.serverPickerHeading}>Chọn nhanh địa chỉ Server:</Text>
                  <View style={styles.serverOptionsRow}>
                    <Pressable
                      onPress={() => switchApiUrl("http://localhost:3000")}
                      android_ripple={m3Ripples.dark}
                      accessibilityRole="button"
                      style={styles.serverOptionChip}
                    >
                      <Text style={styles.serverOptionText}>localhost:3000</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => switchApiUrl("http://10.0.2.2:3000")}
                      android_ripple={m3Ripples.dark}
                      accessibilityRole="button"
                      style={styles.serverOptionChip}
                    >
                      <Text style={styles.serverOptionText}>10.0.2.2:3000 (Emulator)</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => switchApiUrl("http://192.168.99.39:3000")}
                      android_ripple={m3Ripples.dark}
                      accessibilityRole="button"
                      style={styles.serverOptionChip}
                    >
                      <Text style={styles.serverOptionText}>192.168.99.39:3000 (LAN)</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoWrapper: {
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderRadius: m3Shapes.expressive,
    padding: 24,
    borderWidth: 0,
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  loginBtn: {
    marginTop: 8,
  },
  testSection: {
    marginTop: 24,
    paddingTop: 8,
  },
  testSectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  testButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  testChip: {
    flex: 1,
    backgroundColor: colors.m3.surfaceContainer,
    borderRadius: m3Shapes.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 0,
    overflow: "hidden",
  },
  testChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  apiSection: {
    marginTop: 20,
    alignItems: "center",
  },
  apiIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  apiText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  serverPickerBox: {
    width: "100%",
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.m3.surfaceContainerLow,
    borderRadius: m3Shapes.sm,
  },
  serverPickerHeading: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  serverOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  serverOptionChip: {
    backgroundColor: colors.m3.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: m3Shapes.xs,
    overflow: "hidden",
  },
  serverOptionText: {
    fontSize: 11,
    color: colors.textPrimary,
  },
});
