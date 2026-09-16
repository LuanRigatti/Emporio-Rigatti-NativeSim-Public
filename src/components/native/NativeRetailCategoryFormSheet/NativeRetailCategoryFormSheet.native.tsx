import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeRetailCategoryFormSheetFallback from './NativeRetailCategoryFormSheetFallback';
import type { NativeRetailCategoryFormSheetProps } from './NativeRetailCategoryFormSheet.types';

export default function NativeRetailCategoryFormSheetNative(
  props: NativeRetailCategoryFormSheetProps,
) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeRetailCategoryFormSheetSwiftUI.ios')
        .default as ComponentType<NativeRetailCategoryFormSheetProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRetailCategoryFormSheetFallback {...props} />
  );
}
