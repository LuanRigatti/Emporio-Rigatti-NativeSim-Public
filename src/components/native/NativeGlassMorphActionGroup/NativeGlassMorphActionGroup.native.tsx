import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeGlassMorphActionGroupFallback from './NativeGlassMorphActionGroupFallback';
import type { NativeGlassMorphActionGroupProps } from './NativeGlassMorphActionGroup.types';

export default function NativeGlassMorphActionGroupNative(props: NativeGlassMorphActionGroupProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeGlassMorphActionGroupSwiftUI.ios')
        .default as ComponentType<NativeGlassMorphActionGroupProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassMorphActionGroupFallback {...props} />
  );
}
