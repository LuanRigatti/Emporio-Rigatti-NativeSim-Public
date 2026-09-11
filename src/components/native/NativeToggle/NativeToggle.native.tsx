import { createElement, useCallback } from 'react';
import { View } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeToggleExpo from './NativeToggle.expo';
import type { NativeToggleProps } from './NativeToggle.types';

export default function NativeToggleNative(props: NativeToggleProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeToggleSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    createElement(NativeImplementation, props)
  ) : canUseExpoUI ? (
    <View style={{ minHeight: 44, width: '100%' }} />
  ) : (
    <NativeToggleExpo {...props} />
  );
}
