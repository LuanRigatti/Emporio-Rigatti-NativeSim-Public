import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeRetailClientFormSheetFallback from './NativeRetailClientFormSheetFallback';
import type { NativeRetailClientFormSheetProps } from './NativeRetailClientFormSheet.types';

export default function NativeRetailClientFormSheetNative(props: NativeRetailClientFormSheetProps) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeRetailClientFormSheetSwiftUI.ios')
        .default as ComponentType<NativeRetailClientFormSheetProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRetailClientFormSheetFallback {...props} />
  );
}
