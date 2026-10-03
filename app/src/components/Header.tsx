import React from "react";
import { HStack, VStack, Text, Pressable, Box } from "@gluestack-ui/themed";
import { colors, shadows } from "../constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  return (
    <HStack
      bg={colors.surface}
      px="$5"
      py="$4"
      alignItems="center"
      justifyContent="space-between"
      style={shadows.subtle}
    >
      <HStack alignItems="center" flex={1}>
        {onBack && (
          <Pressable
            onPress={onBack}
            mr="$3"
            p="$1"
            borderRadius={8}
            sx={{
              ":active": {
                opacity: 0.7,
              },
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
        )}
        <VStack flex={1}>
          <Text
            color={colors.textPrimary}
            fontSize="$lg"
            fontWeight="$bold"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text color={colors.textSecondary} fontSize="$xs" mt="$0.5">
              {subtitle}
            </Text>
          )}
        </VStack>
      </HStack>
      {rightAction && <Box ml="$3">{rightAction}</Box>}
    </HStack>
  );
};
