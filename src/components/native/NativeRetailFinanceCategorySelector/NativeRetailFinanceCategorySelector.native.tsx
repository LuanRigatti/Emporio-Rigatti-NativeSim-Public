import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeRetailFinanceCategorySelectorFallback from './NativeRetailFinanceCategorySelectorFallback';
import type { NativeRetailFinanceCategorySelectorProps } from './NativeRetailFinanceCategorySelector.types';

export default function NativeRetailFinanceCategorySelectorNative(
  props: NativeRetailFinanceCategorySelectorProps,
) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeRetailFinanceCategorySelectorSwiftUI.ios')
        .default as ComponentType<NativeRetailFinanceCategorySelectorProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeRetailFinanceCategorySelectorFallback {...props} />
  );
}
