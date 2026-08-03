import { createElement, useCallback, useEffect, useState, type ComponentType } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { hasNativeModule } from '@/platform/nativeModules';
import { isDevelopmentBuildRuntime } from '@/platform/runtimeEnvironment';

import type {
  NativeStartupSplashProps,
  NativeStartupSplashReadyEvent,
} from '../../../../modules/native-startup-splash';

import { SplashFallback } from './SplashFallback';
import type { SplashVisualProps } from './SplashVisual.types';

const noop = () => undefined;

export default function SplashNativeSwiftUI(props: SplashVisualProps) {
  const { onOverlayReady } = props;
  const canUseNativeSplash =
    Platform.OS === 'ios' && isDevelopmentBuildRuntime() && hasNativeModule('NativeStartupSplash');
  const [nativeLoadFailed, setNativeLoadFailed] = useState(false);
  const [NativeImplementation, setNativeImplementation] =
    useState<ComponentType<NativeStartupSplashProps> | null>(null);
  const loadImplementation = useCallback(
    () =>
      import('../../../../modules/native-startup-splash').then(
        (module) => module.NativeStartupSplash,
      ),
    [],
  );
  const handleNativeReady = useCallback(
    (event: NativeStartupSplashReadyEvent) => {
      if (event.nativeEvent.ready) {
        onOverlayReady();
      } else {
        setNativeLoadFailed(true);
      }
    },
    [onOverlayReady],
  );

  useEffect(() => {
    if (!canUseNativeSplash) return;

    let mounted = true;

    void loadImplementation().then(
      (implementation) => {
        if (mounted) setNativeImplementation(() => implementation);
      },
      () => {
        if (mounted) setNativeLoadFailed(true);
      },
    );

    return () => {
      mounted = false;
    };
  }, [canUseNativeSplash, loadImplementation]);

  if (!canUseNativeSplash || nativeLoadFailed) {
    return <SplashFallback {...props} />;
  }

  if (!NativeImplementation) {
    return <SplashFallback {...props} onOverlayReady={noop} startReveal={false} />;
  }

  return (
    <View pointerEvents="none" style={styles.root}>
      {createElement(NativeImplementation, {
        colorScheme: props.colorScheme,
        onAnimationComplete: () => props.onAnimationComplete(),
        onReady: handleNativeReady,
        reduceMotion: props.reduceMotion,
        startReveal: props.startReveal,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
