import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeDailyDataSheetFallback from './NativeDailyDataSheetFallback';
import type { NativeDailyDataSheetProps } from './NativeDailyDataSheet.types';

export default function NativeDailyDataSheetNative(props: NativeDailyDataSheetProps) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativeDailyDataSheetSwiftUI.ios')
        .default as ComponentType<NativeDailyDataSheetProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeDailyDataSheetFallback {...props} />
  );
}
