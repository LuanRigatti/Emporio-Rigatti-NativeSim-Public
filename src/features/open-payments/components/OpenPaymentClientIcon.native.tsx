import { StyleSheet, View } from 'react-native';

import OpenPaymentClientIconFallback, {
  type OpenPaymentClientIconProps,
} from './OpenPaymentClientIconFallback';

export default function OpenPaymentClientIconNative({
  backgroundColor,
  iconColor,
  iconName,
}: OpenPaymentClientIconProps) {
  return (
    <View style={styles.frame}>
      <OpenPaymentClientIconFallback
        backgroundColor={backgroundColor}
        iconColor={iconColor}
        iconName={iconName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
});
