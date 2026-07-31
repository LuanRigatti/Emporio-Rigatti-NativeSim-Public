import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import SettingsIconFallback from './SettingsIconFallback';
import type { SettingsIconProps } from './SettingsIcon.types';

export default function SettingsIconNative(props: SettingsIconProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./SettingsIconSwiftUI.ios').default as ComponentType<SettingsIconProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <SettingsIconFallback {...props} />
  );
}
