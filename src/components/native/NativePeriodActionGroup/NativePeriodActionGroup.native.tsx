import type { ComponentType } from 'react';
import { View } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativePeriodActionGroupFallback from './NativePeriodActionGroupFallback';
import {
  getNativePeriodActionGroupWidth,
  type NativePeriodActionGroupProps,
} from './NativePeriodActionGroup.types';

export default function NativePeriodActionGroupNative(props: NativePeriodActionGroupProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./NativePeriodActionGroupSwiftUI.ios')
        .default as ComponentType<NativePeriodActionGroupProps>)
      : null;

  if (!NativeImplementation) {
    return <NativePeriodActionGroupFallback {...props} />;
  }

  return (
    <View
      style={{
        width: getNativePeriodActionGroupWidth(props),
      }}
    >
      <NativeImplementation {...props} />
    </View>
  );
}
