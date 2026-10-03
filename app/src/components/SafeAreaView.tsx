import React from "react";
import {
  SafeAreaView as RNSafeAreaView,
  NativeSafeAreaViewProps,
} from "react-native-safe-area-context";
import { colors } from "../constants/theme";

export const SafeAreaView: React.FC<NativeSafeAreaViewProps> = ({
  style,
  children,
  ...props
}) => {
  return (
    <RNSafeAreaView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      {...props}
    >
      {children}
    </RNSafeAreaView>
  );
};
