import { StyleSheet, View } from 'react-native';

import OpenPaymentClientIconFallback from './OpenPaymentClientIconFallback';

export default function OpenPaymentClientIconNative() {
  return (
    <View style={styles.frame}>
      <OpenPaymentClientIconFallback />
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
