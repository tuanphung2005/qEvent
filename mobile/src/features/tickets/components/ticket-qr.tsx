import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors } from '@/theme/tokens';

const QR_SIZE = 232;

/** The value is a signed token: never log it, label it, or put it in text. */
export function TicketQr({ value }: { value: string }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="rounded-card bg-card p-4">
      <QRCode
        value={value}
        size={QR_SIZE}
        color={colors.text}
        backgroundColor={colors.card}
        ecl="M"
      />
    </View>
  );
}
