import { StyleSheet, View } from 'react-native';

import type { NativeStartupSplashProps } from './NativeStartupSplash';

export default function NativeStartupSplashView(_props: NativeStartupSplashProps) {
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
