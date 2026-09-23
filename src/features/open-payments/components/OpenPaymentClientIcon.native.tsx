import { StyleSheet, View } from 'react-native';

import OpenPaymentClientIconFallback from './OpenPaymentClientIconFallback';

export default function OpenPaymentClientIconNative({
  backgroundColor,
}: {
  backgroundColor?: string;
}) {
  return (
    <View style={styles.frame}>
      <OpenPaymentClientIconFallback backgroundColor={backgroundColor} />
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
