import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';

import NativeThinkingOrbFallback from './NativeThinkingOrbFallback';
import type { NativeThinkingOrbProps, NativeThinkingOrbViewProps } from './NativeThinkingOrb.types';

const nativeModule = requireOptionalNativeModule<object>('NativeThinkingOrb');
const NativeView: ComponentType<NativeThinkingOrbViewProps> | null = nativeModule
  ? requireNativeView<NativeThinkingOrbViewProps>('NativeThinkingOrb', 'NativeThinkingOrbView')
  : null;

export default function NativeThinkingOrbViewIOS(props: NativeThinkingOrbProps) {
  if (!NativeView) {
    return <NativeThinkingOrbFallback {...props} />;
  }

  const { fallbackColor: _fallbackColor, ...nativeProps } = props;
  return <NativeView {...nativeProps} />;
}
