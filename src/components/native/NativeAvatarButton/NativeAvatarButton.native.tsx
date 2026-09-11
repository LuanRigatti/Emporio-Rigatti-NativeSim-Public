import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeAvatarButtonFallback from './NativeAvatarButtonFallback';
import type { NativeAvatarButtonProps } from './NativeAvatarButton.types';

export default function NativeAvatarButtonNative(props: NativeAvatarButtonProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeAvatarButtonSwiftUI.ios').default as ComponentType<NativeAvatarButtonProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeAvatarButtonFallback {...props} />
  );
}
