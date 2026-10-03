import React from "react";
import { Box } from "@gluestack-ui/themed";
import { ViewStyle } from "react-native";
import { colors, shadows } from "../constants/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "card" | "floating" | "subtle";
}

export const Card: React.FC<CardProps> = ({ children, style, variant = "card" }) => {
  return (
    <Box
      bg={colors.surface}
      borderRadius={16}
      p="$4"
      borderWidth={0}
      style={[shadows[variant], style]}
    >
      {children}
    </Box>
  );
};
