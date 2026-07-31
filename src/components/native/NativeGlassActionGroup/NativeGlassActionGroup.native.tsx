import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeGlassActionGroupFallback from './NativeGlassActionGroupFallback';
import type { NativeGlassActionGroupProps } from './NativeGlassActionGroup.types';

export default function NativeGlassActionGroupNative(props: NativeGlassActionGroupProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeGlassActionGroupSwiftUI.ios')
        .default as ComponentType<NativeGlassActionGroupProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassActionGroupFallback {...props} />
  );
}
