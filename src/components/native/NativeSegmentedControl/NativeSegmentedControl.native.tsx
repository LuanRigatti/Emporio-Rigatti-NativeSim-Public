import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import NativeSegmentedControlExpo from './NativeSegmentedControl.expo';
import type { NativeSegmentedControlProps } from './NativeSegmentedControl.types';

export default function NativeSegmentedControlNative(props: NativeSegmentedControlProps) {
  const canUseExpoUI = getNativeCapabilities().canUseNativePicker;
  const loadImplementation = useCallback(
    () => import('./NativeSegmentedControlSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    // eslint-disable-next-line react-hooks/static-components
    <NativeImplementation {...props} />
  ) : (
    <NativeSegmentedControlExpo {...props} />
  );
}
