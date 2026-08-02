import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeClientFormSheetFallback from './NativeClientFormSheetFallback';
import type { NativeClientFormSheetProps } from './NativeClientFormSheet.types';

export default function NativeClientFormSheetNative(props: NativeClientFormSheetProps) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeClientFormSheetSwiftUI.ios')
        .default as ComponentType<NativeClientFormSheetProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeClientFormSheetFallback {...props} />
  );
}
