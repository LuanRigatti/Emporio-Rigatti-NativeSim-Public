import { View } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeSearchFieldExpo from './NativeSearchField.expo';
import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldNative(props: NativeSearchFieldProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? require('./NativeSearchFieldSwiftUI.ios').default // eslint-disable-line @typescript-eslint/no-require-imports
    : null;

  if (NativeImplementation) {
    return <NativeImplementation {...props} />;
  }

  return canUseExpoUI ? (
    <View style={{ height: 36, width: '100%' }} />
  ) : (
    <NativeSearchFieldExpo {...props} />
  );
}
