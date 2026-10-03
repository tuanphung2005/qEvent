import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from "react-native";
import { colors, m3Shapes, m3Ripples } from "../constants/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "success" | "warning" | "danger" | "secondary" | "tonal";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  accessibilityLabel,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return colors.m3.surfaceContainerHigh;
    switch (variant) {
      case "primary":
        return colors.primary;
      case "success":
        return colors.success;
      case "warning":
        return colors.warning;
      case "danger":
        return colors.error;
      case "secondary":
        return colors.neutralFill;
      case "tonal":
        return colors.m3.primaryContainer;
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    if (variant === "secondary") return colors.textPrimary;
    if (variant === "tonal") return colors.m3.onPrimaryContainer;
    return colors.white;
  };

  const getRippleColor = () => {
    if (variant === "secondary" || variant === "tonal") {
      return m3Ripples.dark.color;
    }
    return m3Ripples.light.color;
  };

  const textColor = getTextColor();

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading }}
      android_ripple={{
        color: getRippleColor(),
        borderless: false,
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          opacity: Platform.OS === "ios" && pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.text, { color: textColor }, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: m3Shapes.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 0,
    overflow: "hidden", // Required for Android ripple to respect border radius
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
