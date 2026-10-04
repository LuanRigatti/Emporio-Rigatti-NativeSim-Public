import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { NativeSendIntelligencePickerProps } from './NativeModelIntensitySlider.types';

const nativeModule = requireOptionalNativeModule('NativeModelIntensitySlider');
const NativeView = nativeModule
  ? requireNativeView<NativeSendIntelligencePickerProps>(
      'NativeModelIntensitySlider',
      'NativeSendIntelligencePickerView',
    )
  : null;

export default function NativeSendIntelligencePickerViewIOS(
  props: NativeSendIntelligencePickerProps,
) {
  return NativeView ? <NativeView {...props} /> : null;
}
