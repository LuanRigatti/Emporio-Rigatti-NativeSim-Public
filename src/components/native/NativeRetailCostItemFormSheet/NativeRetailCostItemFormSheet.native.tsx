import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeRetailCostItemFormSheetFallback from './NativeRetailCostItemFormSheetFallback';
import type { NativeRetailCostItemFormSheetProps } from './NativeRetailCostItemFormSheet.types';

export default function NativeRetailCostItemFormSheetNative(
  props: NativeRetailCostItemFormSheetProps,
) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeRetailCostItemFormSheetSwiftUI.ios')
        .default as ComponentType<NativeRetailCostItemFormSheetProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRetailCostItemFormSheetFallback {...props} />
  );
}
