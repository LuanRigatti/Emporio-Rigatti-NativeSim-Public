import { useEffect } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useStartupDiagnostics } from '@/utils/startupLayoutDiagnostics';

import NativeGlassMenuFallback from './NativeGlassMenuFallback';
import type { NativeGlassMenuProps } from './NativeGlassMenu.types';

export default function NativeGlassMenuNative(props: NativeGlassMenuProps) {
  const { onImplementationReady } = props;
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const NativeImplementation = canUseExpoUI
    ? require('./NativeGlassMenuSwiftUI.ios').default // eslint-disable-line @typescript-eslint/no-require-imports
    : null;

  useStartupDiagnostics('NativeGlassMenu', {
    canUseExpoUI,
    implementation: NativeImplementation ? 'SwiftUI-sync' : 'fallback',
  });

  useEffect(() => {
    if (NativeImplementation) {
      onImplementationReady?.();
    }
  }, [NativeImplementation, onImplementationReady]);

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <NativeGlassMenuFallback {...props} />
  );
}
