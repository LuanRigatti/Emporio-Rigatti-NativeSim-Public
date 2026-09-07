import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import OpenPaymentClientIconFallback from './OpenPaymentClientIcon';

export default function OpenPaymentClientIconNative() {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./OpenPaymentClientIconSwiftUI.ios').default as ComponentType)
    : null;

  return NativeImplementation ? <NativeImplementation /> : <OpenPaymentClientIconFallback />;
}
