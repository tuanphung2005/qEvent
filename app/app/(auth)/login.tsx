import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  TextInput,
  Button,
  Card,
  SegmentedButtons,
  Chip,
} from "react-native-paper";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/api/client";
import { colors, shadows, m3Shapes } from "../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const [email, setEmail] = useState("attendee@qcheck.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("attendee");
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

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    if (role === "attendee") {
      setEmail("attendee@qcheck.com");
      setPassword("password123");
    } else {
      setEmail("staff1@qcheck.com");
      setPassword("password123");
    }
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
          {/* Logo & Branding */}
          <View style={styles.logoSection}>
            <View style={styles.logoWrapper}>
              <Ionicons name="qr-code" size={52} color={colors.black} />
            </View>
            <Text style={styles.brandTitle}>qCheck</Text>
            <Text style={styles.brandSubtitle}>
              Soát vé sự kiện tức thời & Chống trùng lặp
            </Text>
          </View>

          {/* M3 Expressive Card Container */}
          <Card
            mode="contained"
            style={[styles.loginCard, shadows.floating]}
          >
            <Card.Content>
              <Text style={styles.cardHeading}>Đăng nhập tài khoản</Text>

              {/* M3 Segmented Buttons Role Switcher */}
              <View style={styles.segmentedWrapper}>
                <SegmentedButtons
                  value={selectedRole}
                  onValueChange={handleRoleChange}
                  buttons={[
                    {
                      value: "attendee",
                      label: "Khách tham dự",
                      icon: "account",
                    },
                    {
                      value: "staff",
                      label: "Staff Soát vé",
                      icon: "shield-account",
                    },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>

              {/* Email Input */}
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                mode="outlined"
                outlineStyle={styles.inputOutline}
                left={<TextInput.Icon icon="email-outline" />}
                style={styles.inputField}
              />

              {/* Password Input */}
              <TextInput
                label="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                mode="outlined"
                outlineStyle={styles.inputOutline}
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                style={styles.inputField}
              />

              {/* Login Action Button */}
              <Button
                mode="contained"
                loading={loading}
                disabled={loading}
                onPress={handleLogin}
                icon="login"
                contentStyle={styles.loginBtnContent}
                style={styles.loginBtn}
              >
                Đăng nhập
              </Button>

              {/* API Connection Indicator */}
              <View style={styles.apiSection}>
                <View style={styles.apiIndicatorRow}>
                  <Ionicons name="server-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.apiText}>API: {currentUrl}</Text>
                  <Chip
                    compact
                    mode="outlined"
                    onPress={() => setIsCustomUrlOpen(!isCustomUrlOpen)}
                    style={styles.ipChip}
                  >
                    Đổi IP
                  </Chip>
                </View>

                {isCustomUrlOpen && (
                  <View style={styles.serverPickerBox}>
                    <Text style={styles.serverPickerHeading}>Chọn nhanh địa chỉ Server:</Text>
                    <View style={styles.serverOptionsRow}>
                      <Chip
                        compact
                        onPress={() => switchApiUrl("http://localhost:3000")}
                        style={styles.serverChip}
                      >
                        localhost:3000
                      </Chip>
                      <Chip
                        compact
                        onPress={() => switchApiUrl("http://10.0.2.2:3000")}
                        style={styles.serverChip}
                      >
                        10.0.2.2:3000 (Emulator)
                      </Chip>
                      <Chip
                        compact
                        onPress={() => switchApiUrl("http://192.168.99.39:3000")}
                        style={styles.serverChip}
                      >
                        192.168.99.39:3000 (LAN)
                      </Chip>
                    </View>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
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
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 30,
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
    borderRadius: 28,
    borderWidth: 0,
    paddingVertical: 8,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  segmentedWrapper: {
    marginBottom: 18,
  },
  segmentedButtons: {
    borderRadius: m3Shapes.full,
  },
  inputField: {
    marginBottom: 14,
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 16,
    borderColor: colors.neutralDark,
  },
  loginBtn: {
    marginTop: 8,
    borderRadius: m3Shapes.full,
  },
  loginBtnContent: {
    height: 50,
  },
  apiSection: {
    marginTop: 20,
    alignItems: "center",
  },
  apiIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  apiText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ipChip: {
    height: 28,
  },
  serverPickerBox: {
    width: "100%",
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.m3.surfaceContainerLow,
    borderRadius: 16,
  },
  serverPickerHeading: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: "600",
  },
  serverOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  serverChip: {
    backgroundColor: colors.m3.surfaceContainerHigh,
  },
});
