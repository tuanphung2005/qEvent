import * as ScreenCapture from "expo-screen-capture";
import { Platform } from "react-native";

export const securityService = {
  async enableScreenCaptureProtection() {
    if (Platform.OS === "web") return;
    try {
      await ScreenCapture.preventScreenCaptureAsync();
    } catch {
      // Ignored if platform doesn't support
    }
  },

  async disableScreenCaptureProtection() {
    if (Platform.OS === "web") return;
    try {
      await ScreenCapture.allowScreenCaptureAsync();
    } catch {
      // Ignored if platform doesn't support
    }
  },
};
