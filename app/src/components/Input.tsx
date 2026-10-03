import React from "react";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorText,
  Input as GInput,
  InputField,
} from "@gluestack-ui/themed";
import { TextInputProps, ViewStyle } from "react-native";
import { colors } from "../constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  ...rest
}) => {
  return (
    <FormControl isInvalid={!!error} style={containerStyle} mb="$4">
      {label && (
        <FormControlLabel mb="$1.5">
          <FormControlLabelText
            color={colors.textPrimary}
            fontWeight="$semibold"
            fontSize="$sm"
          >
            {label}
          </FormControlLabelText>
        </FormControlLabel>
      )}

      <GInput
        size="md"
        variant="underlined"
        borderBottomWidth={0}
        borderRadius={12}
        bg="#F1F5F9"
        px="$4"
        py="$1"
        sx={{
          ":focus": {
            borderBottomWidth: 0,
            bg: "#E2E8F0",
          },
        }}
      >
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          color={colors.textPrimary}
          fontSize="$sm"
          style={style}
          {...(rest as any)}
        />
      </GInput>

      {error && (
        <FormControlError mt="$1">
          <FormControlErrorText color={colors.error} fontSize="$xs">
            {error}
          </FormControlErrorText>
        </FormControlError>
      )}
    </FormControl>
  );
};
