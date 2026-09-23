import type { ComponentType } from 'react';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import HomeModeTitleFallback from './HomeModeTitleFallback';
import type { HomeModeTitleProps } from './HomeModeTitleFallback';

export default function HomeModeTitleNative(props: HomeModeTitleProps) {
  const NativeImplementation = getNativeCapabilities().canUseExpoUI
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./HomeModeTitleSwiftUI.ios').default as ComponentType<HomeModeTitleProps>)
    : null;

  return NativeImplementation ? (
    <NativeImplementation {...props} />
  ) : (
    <HomeModeTitleFallback {...props} />
  );
}
