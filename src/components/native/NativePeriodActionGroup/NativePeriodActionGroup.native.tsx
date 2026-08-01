import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativePeriodActionGroupFallback from './NativePeriodActionGroupFallback';
import type { NativePeriodActionGroupProps } from './NativePeriodActionGroup.types';

export default function NativePeriodActionGroupNative(props: NativePeriodActionGroupProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativePeriodActionGroupSwiftUI.ios')
        .default as ComponentType<NativePeriodActionGroupProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativePeriodActionGroupFallback {...props} />
  );
}
