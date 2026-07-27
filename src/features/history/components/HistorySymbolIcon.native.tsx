import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';
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
  const loadImplementation = useCallback(
    () => import('./HistorySymbolIconSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...safeProps} />
  ) : (
    <HistorySymbolIconFallback {...safeProps} />
  );
}
