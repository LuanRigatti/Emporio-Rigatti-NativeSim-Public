import { useCallback } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useLazyNativeImplementation } from '@/platform/useLazyNativeImplementation';

import HistorySymbolIconFallback from './HistorySymbolIconFallback';
import type { HistorySymbolIconProps } from './HistorySymbolIcon.types';

export default function HistorySymbolIconNative(props: HistorySymbolIconProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const loadImplementation = useCallback(
    () => import('./HistorySymbolIconSwiftUI.ios').then((module) => module.default),
    [],
  );
  const NativeImplementation = useLazyNativeImplementation(canUseExpoUI, loadImplementation);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <HistorySymbolIconFallback {...props} />
  );
}
