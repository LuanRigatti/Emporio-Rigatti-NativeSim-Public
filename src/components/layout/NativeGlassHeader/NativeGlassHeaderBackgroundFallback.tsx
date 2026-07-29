import { StyleSheet, View } from 'react-native';

import type { NativeGlassHeaderBackgroundProps } from './NativeGlassHeader.types';

export default function NativeGlassHeaderBackgroundFallback({
  mode,
  style,
}: NativeGlassHeaderBackgroundProps) {
  const backgroundStyle = [styles.background, style];

  return <View pointerEvents="none" style={backgroundStyle} />;
}

const styles = StyleSheet.create({
  background: { ...StyleSheet.absoluteFillObject },
});
