import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, shadows, m3Shapes } from "../constants/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "card" | "floating" | "subtle";
  containerVariant?: "surface" | "surfaceContainerLow" | "surfaceContainer" | "surfaceContainerHigh";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = "card",
  containerVariant = "surface",
}) => {
  const getBackgroundColor = () => {
    switch (containerVariant) {
      case "surfaceContainerLow":
        return colors.m3.surfaceContainerLow;
      case "surfaceContainer":
        return colors.m3.surfaceContainer;
      case "surfaceContainerHigh":
        return colors.m3.surfaceContainerHigh;
      default:
        return colors.surface;
    }
  };

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: getBackgroundColor() },
        shadows[variant],
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: m3Shapes.lg,
    padding: 16,
    borderWidth: 0,
  },
});
