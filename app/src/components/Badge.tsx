import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors, m3Shapes } from "../constants/theme";

export interface BadgeProps {
  label: string;
  variant?: "success" | "warning" | "error" | "info" | "neutral" | "default";
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "default",
  style,
  textStyle,
  icon,
}) => {
  const getBadgeConfig = () => {
    switch (variant) {
      case "success":
        return { bg: colors.m3.successContainer, text: colors.m3.onSuccessContainer };
      case "warning":
        return { bg: colors.m3.warningContainer, text: colors.m3.onWarningContainer };
      case "error":
        return { bg: colors.m3.errorContainer, text: colors.m3.onErrorContainer };
      case "info":
        return { bg: colors.m3.primaryContainer, text: colors.m3.onPrimaryContainer };
      case "neutral":
      default:
        return { bg: colors.m3.surfaceContainer, text: colors.textSecondary };
    }
  };

  const { bg, text } = getBadgeConfig();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.text, { color: text }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: m3Shapes.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
