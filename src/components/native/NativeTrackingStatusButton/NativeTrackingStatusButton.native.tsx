import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import NativeTrackingStatusButtonFallback from './NativeTrackingStatusButtonFallback';
import type { NativeTrackingStatusButtonProps } from './NativeTrackingStatusButton.types';

export default function NativeTrackingStatusButtonNative(props: NativeTrackingStatusButtonProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeTrackingStatusButtonSwiftUI.ios')
        .default as ComponentType<NativeTrackingStatusButtonProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeTrackingStatusButtonFallback {...props} />
  );
}
