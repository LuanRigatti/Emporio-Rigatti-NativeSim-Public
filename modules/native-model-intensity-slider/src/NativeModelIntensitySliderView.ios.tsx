import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import NativeModelIntensitySliderFallback from './NativeModelIntensitySliderFallback';
import type { NativeModelIntensitySliderProps } from './NativeModelIntensitySlider.types';

const nativeModule = requireOptionalNativeModule<object>('NativeModelIntensitySlider');
const NativeView: ComponentType<NativeModelIntensitySliderProps> | null = nativeModule
  ? requireNativeView<NativeModelIntensitySliderProps>(
      'NativeModelIntensitySlider',
      'NativeModelIntensitySliderView',
    )
  : null;

export const nativeModelIntensitySliderAvailable = NativeView !== null;

export default function NativeModelIntensitySliderViewIOS(props: NativeModelIntensitySliderProps) {
  return NativeView ? <NativeView {...props} /> : <NativeModelIntensitySliderFallback {...props} />;
}
