import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeRetailEntryFormSheetFallback from './NativeRetailEntryFormSheetFallback';
import type { NativeRetailCostEntryFormSheetProps } from './NativeRetailEntryFormSheet.types';

export default function NativeRetailEntryFormSheetNative(
  props: NativeRetailCostEntryFormSheetProps,
) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeRetailEntryFormSheetSwiftUI.ios')
        .default as ComponentType<NativeRetailCostEntryFormSheetProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRetailEntryFormSheetFallback {...props} />
  );
}
