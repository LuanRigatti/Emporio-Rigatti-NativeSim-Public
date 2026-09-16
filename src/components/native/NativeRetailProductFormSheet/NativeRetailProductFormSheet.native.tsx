import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeRetailProductFormSheetFallback from './NativeRetailProductFormSheetFallback';
import type { NativeRetailProductFormSheetProps } from './NativeRetailProductFormSheet.types';

export default function NativeRetailProductFormSheetNative(
  props: NativeRetailProductFormSheetProps,
) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeRetailProductFormSheetSwiftUI.ios')
        .default as ComponentType<NativeRetailProductFormSheetProps>)
    : null;
  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRetailProductFormSheetFallback {...props} />
  );
}
