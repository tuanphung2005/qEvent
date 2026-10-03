import React from "react";
import { Stack } from "expo-router";
import { colors } from "../../src/constants/theme";

export default function StaffLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="scanner" options={{ headerShown: false }} />
      <Stack.Screen
        name="sync-status"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
