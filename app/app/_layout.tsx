import { LogBox } from "react-native";
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { config } from "@gluestack-ui/config";
import { AuthProvider } from "../src/context/AuthContext";
import { OfflineSyncProvider } from "../src/context/OfflineSyncContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GluestackUIProvider config={config}>
        <AuthProvider>
          <OfflineSyncProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: "slide_from_right",
              }}
            />
          </OfflineSyncProvider>
        </AuthProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
