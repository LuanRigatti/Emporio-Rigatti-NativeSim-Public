import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeListExpo from './NativeList.expo';
import type { NativeListProps } from './NativeList.types';

export default function NativeListNative(props: NativeListProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./NativeListSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? <NativeImplementation {...props} /> : <NativeListExpo {...props} />;
}
