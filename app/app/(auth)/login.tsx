import React, { useState } from "react";
import {
  View,
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
  Text,
  useTheme,
  Surface,
} from "react-native-paper";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/api/client";
import { colors, m3Shapes } from "../../src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const theme = useTheme();
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
          {/* M3 Hero Branding Header */}
          <View style={styles.heroSection}>
            <Surface style={styles.heroIconBadge} elevation={2}>
              <Ionicons name="qr-code" size={40} color={theme.colors.primary} />
            </Surface>
            <Text variant="headlineMedium" style={styles.brandTitle}>
              qCheck
            </Text>
            <Text variant="bodyMedium" style={styles.brandSubtitle}>
              Soát vé sự kiện tức thời & Chống vé giả
            </Text>
          </View>

          {/* M3 Expressive Card Container */}
          <Card mode="elevated" style={styles.loginCard} elevation={1}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Đăng nhập tài khoản
              </Text>

              {/* M3 Segmented Buttons Role Switcher */}
              <SegmentedButtons
                value={selectedRole}
                onValueChange={handleRoleChange}
                buttons={[
                  {
                    value: "attendee",
                    label: "Khách tham dự",
                    icon: "ticket-confirmation-outline",
                  },
                  {
                    value: "staff",
                    label: "Staff soát vé",
                    icon: "camera-iris",
                  },
                ]}
                style={styles.roleSegment}
              />

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
                    icon={showPassword ? "eye-off-outline" : "eye-outline"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                style={styles.inputField}
              />

              {/* M3 Large Pill Login Button */}
              <Button
                mode="contained"
                loading={loading}
                disabled={loading}
                onPress={handleLogin}
                icon="arrow-right"
                contentStyle={styles.loginBtnContent}
                style={styles.loginBtn}
              >
                Đăng nhập ngay
              </Button>

              {/* M3 Server / Environment Tonal Chip */}
              <Surface style={styles.serverSurface} elevation={0}>
                <View style={styles.serverRow}>
                  <Ionicons name="cloud-outline" size={16} color={theme.colors.onSurfaceVariant} />
                  <Text variant="labelMedium" style={styles.serverLabel} numberOfLines={1}>
                    Server: {currentUrl.replace("http://", "")}
                  </Text>
                  <Chip
                    compact
                    mode="flat"
                    onPress={() => setIsCustomUrlOpen(!isCustomUrlOpen)}
                    style={styles.switchChip}
                  >
                    Đổi IP
                  </Chip>
                </View>

                {isCustomUrlOpen && (
                  <View style={styles.serverChoices}>
                    <Chip
                      compact
                      mode={currentUrl.includes("localhost") ? "flat" : "outlined"}
                      onPress={() => switchApiUrl("http://localhost:3000")}
                    >
                      localhost:3000
                    </Chip>
                    <Chip
                      compact
                      mode={currentUrl.includes("10.0.2.2") ? "flat" : "outlined"}
                      onPress={() => switchApiUrl("http://10.0.2.2:3000")}
                    >
                      10.0.2.2 (Android)
                    </Chip>
                    <Chip
                      compact
                      mode={currentUrl.includes("192.168") ? "flat" : "outlined"}
                      onPress={() => switchApiUrl("http://192.168.99.39:3000")}
                    >
                      192.168.99.39 (LAN)
                    </Chip>
                  </View>
                )}
              </Surface>
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
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  heroIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.m3.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brandTitle: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
  },
  cardContent: {
    padding: 24,
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 16,
    color: colors.textPrimary,
  },
  roleSegment: {
    marginBottom: 18,
  },
  inputField: {
    marginBottom: 14,
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 16,
  },
  loginBtn: {
    marginTop: 10,
    borderRadius: m3Shapes.full,
  },
  loginBtnContent: {
    height: 52,
  },
  serverSurface: {
    marginTop: 20,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.m3.surfaceContainerLow,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  serverLabel: {
    flex: 1,
    color: colors.textSecondary,
  },
  switchChip: {
    borderRadius: m3Shapes.full,
  },
  serverChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutralDark,
  },
});
