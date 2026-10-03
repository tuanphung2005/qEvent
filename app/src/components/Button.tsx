import React from "react";
import {
  Button as GButton,
  ButtonText as GButtonText,
  ButtonSpinner as GButtonSpinner,
  ButtonIcon as GButtonIcon,
} from "@gluestack-ui/themed";
import { ViewStyle, TextStyle } from "react-native";
import { colors } from "../constants/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "success" | "warning" | "danger" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
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
}) => {
  const getAction = () => {
    switch (variant) {
      case "success":
        return "positive";
      case "warning":
        return "secondary";
      case "danger":
        return "negative";
      case "secondary":
        return "secondary";
      default:
        return "primary";
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return "#E2E8F0";
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
        return "#EEF2F6";
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textMuted;
    if (variant === "secondary") return colors.textPrimary;
    return "#FFFFFF";
  };

  return (
    <GButton
      action={getAction()}
      size="md"
      isDisabled={disabled || loading}
      onPress={onPress}
      borderWidth={0}
      borderRadius={12}
      bg={getBackgroundColor()}
      sx={{
        ":active": {
          opacity: 0.85,
        },
      }}
      style={style}
    >
      {loading ? (
        <GButtonSpinner color={getTextColor()} />
      ) : (
        <>
          {icon && <GButtonIcon as={() => icon as any} mr="$2" />}
          <GButtonText
            color={getTextColor()}
            fontWeight="$semibold"
            fontSize="$sm"
            style={textStyle}
          >
            {title}
          </GButtonText>
        </>
      )}
    </GButton>
  );
};
