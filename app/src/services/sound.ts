import { createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";

class SoundService {
  async playSuccess() {
    if (Platform.OS === "web") return;
    try {
      const player = createAudioPlayer({
        uri: "https://actions.google.com/sounds/v1/cartoon/pop.ogg",
      });
      player.play();
    } catch {
      // Graceful fallback if audio is not supported in environment
    }
  }
}

export const soundService = new SoundService();
