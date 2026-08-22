import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeGlassIconButtonFallback from './NativeGlassIconButtonFallback';
import type { NativeGlassIconButtonProps } from './NativeGlassIconButton.types';

export default function NativeGlassIconButtonNative(props: NativeGlassIconButtonProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeGlassIconButtonSwiftUI.ios')
        .default as ComponentType<NativeGlassIconButtonProps>)
      : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassIconButtonFallback {...props} />
  );
}
