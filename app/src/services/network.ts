import * as Network from "expo-network";
import { Platform } from "react-native";

export const networkService = {
  async isOnline(): Promise<boolean> {
    if (Platform.OS === "web") {
      return typeof navigator !== "undefined" ? navigator.onLine : true;
    }
    try {
      const state = await Network.getNetworkStateAsync();
      return !!state.isConnected && !!state.isInternetReachable;
    } catch {
      return true; // Fallback to optimistic online
    }
  },
};
