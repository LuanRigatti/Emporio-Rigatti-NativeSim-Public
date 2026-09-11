import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { NativeStartupSplashProps } from './NativeStartupSplash';

const NativeStartupSplashView: ComponentType<NativeStartupSplashProps> = requireNativeView(
  'NativeStartupSplash',
  'NativeStartupSplashView',
);

export default NativeStartupSplashView;
