import React from "react";
import {
  Badge as GBadge,
  BadgeText as GBadgeText,
} from "@gluestack-ui/themed";
import { ViewStyle } from "react-native";
import { colors } from "../constants/theme";

interface BadgeProps {
  label: string;
  variant?: "success" | "warning" | "error" | "info" | "default";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = "default", style }) => {
  const getBadgeConfig = () => {
    switch (variant) {
      case "success":
        return { action: "success" as const, bg: colors.successLight, text: colors.success };
      case "warning":
        return { action: "warning" as const, bg: colors.warningLight, text: colors.warning };
      case "error":
        return { action: "error" as const, bg: colors.errorLight, text: colors.error };
      case "info":
        return { action: "info" as const, bg: colors.primaryLight, text: colors.primary };
      default:
        return { action: "muted" as const, bg: colors.neutralFill, text: colors.textSecondary };
    }
  };

  const { action, bg, text } = getBadgeConfig();

  return (
    <GBadge
      action={action}
      variant="solid"
      size="sm"
      borderRadius={20}
      px="$3"
      py="$1"
      bg={bg}
      borderWidth={0}
      alignSelf="flex-start"
      style={style}
    >
      <GBadgeText color={text} fontWeight="$semibold" fontSize="$xs">
        {label}
      </GBadgeText>
    </GBadge>
  );
};
