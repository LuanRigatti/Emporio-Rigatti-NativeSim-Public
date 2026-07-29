import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import type { ComponentType } from 'react';

import NativeDropdownExpo from './NativeDropdown.expo';
import type { NativeDropdownProps } from './NativeDropdown.types';

export default function NativeDropdownNative<T extends string | number>(
  props: NativeDropdownProps<T>,
) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;

  if (!canUseExpoUI) {
    return <NativeDropdownExpo {...props} />;
  }

  // Only Development Builds with Expo UI reach this branch.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NativeDropdownSwiftUI = require('./NativeDropdownSwiftUI.ios').default as ComponentType<
    NativeDropdownProps<T>
  >;

  return <NativeDropdownSwiftUI {...props} />;
}
