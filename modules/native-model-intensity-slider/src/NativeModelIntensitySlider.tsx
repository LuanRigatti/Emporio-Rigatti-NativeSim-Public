import NativeModelIntensitySliderView from './NativeModelIntensitySliderView';
import type { NativeModelIntensitySliderProps } from './NativeModelIntensitySlider.types';

export { nativeModelIntensitySliderAvailable } from './NativeModelIntensitySliderView';

export default function NativeModelIntensitySlider(props: NativeModelIntensitySliderProps) {
  return <NativeModelIntensitySliderView {...props} />;
}
