import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useAppTheme } from '@/theme';

import HistorySymbolIconFallback from './HistorySymbolIconFallback';
import type { HistorySymbolIconProps } from './HistorySymbolIcon.types';

export default function HistorySymbolIconNative(props: HistorySymbolIconProps | null) {
  const { theme } = useAppTheme();
  const safeProps: HistorySymbolIconProps = {
    color: props?.color ?? theme.colors.textPrimary,
    fallbackIcon: props?.fallbackIcon ?? 'help-circle-outline',
    size: props?.size ?? theme.sizes.iconMedium,
    systemName: props?.systemName ?? 'questionmark.circle',
  };
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./HistorySymbolIconSwiftUI.ios').default as ComponentType<HistorySymbolIconProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...safeProps} />
  ) : (
    <HistorySymbolIconFallback {...safeProps} />
  );
}
