import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { SplashVisualProps } from './SplashVisual.types';

export function SplashFallback({
  colorScheme,
  onOverlayReady,
  onAnimationComplete,
  startReveal,
}: SplashVisualProps) {
  useEffect(() => {
    onOverlayReady();
  }, [onOverlayReady]);

  useEffect(() => {
    if (startReveal) onAnimationComplete();
  }, [onAnimationComplete, startReveal]);

  return (
    <View
      style={[styles.root, { backgroundColor: colorScheme === 'dark' ? '#0B0F14' : '#FFFFFF' }]}
    >
      <Image
        resizeMode="cover"
        source={
          colorScheme === 'dark'
            ? require('../../../../assets/branding/splash-dark.png')
            : require('../../../../assets/branding/splash-light.png')
        }
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
