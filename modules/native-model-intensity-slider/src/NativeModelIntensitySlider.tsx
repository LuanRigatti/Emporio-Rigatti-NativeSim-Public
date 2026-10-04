import NativeModelIntensitySliderView from './NativeModelIntensitySliderView';
import NativeSendIntelligencePickerView from './NativeSendIntelligencePickerView';
import type {
  NativeModelIntensitySliderProps,
  NativeSendIntelligencePickerProps,
} from './NativeModelIntensitySlider.types';

export {
  cancelNativeSendGesture,
  nativeModelIntensitySliderAvailable,
  registerNativeSendButton,
  subscribeToNativeSendHoldEvents,
  unregisterNativeSendButton,
} from './NativeModelIntensitySliderView';

export default function NativeModelIntensitySlider(props: NativeModelIntensitySliderProps) {
  return <NativeModelIntensitySliderView {...props} />;
}

export function NativeSendIntelligencePicker(props: NativeSendIntelligencePickerProps) {
  return <NativeSendIntelligencePickerView {...props} />;
}
