import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const hapticFeedback = {
  // 1 nhịp nhẹ khi vé hợp lệ (NFR-09)
  async success() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Ignore if device doesn't support
    }
  },

  // 2 nhịp rung khi vé trùng lặp / đã quét trước đó (NFR-09)
  async duplicate() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }, 150);
    } catch {
      // Ignore if device doesn't support
    }
  },

  // Rung dài khi mã không hợp lệ hoặc lỗi (NFR-09)
  async error() {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Ignore if device doesn't support
    }
  },
};
