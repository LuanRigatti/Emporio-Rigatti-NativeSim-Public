import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import NativeModelIntensitySliderFallback from './NativeModelIntensitySliderFallback';
import type {
  NativeModelIntensitySliderProps,
  NativeSendHoldCompletionEvent,
  NativeSendHoldEvent,
  NativeSendHoldEventName,
  NativeSendHoldListener,
} from './NativeModelIntensitySlider.types';

interface NativeModelIntensitySliderModule {
  addListener(
    eventName: NativeSendHoldEventName,
    listener: (event: NativeSendHoldEvent | NativeSendHoldCompletionEvent) => void,
  ): { remove: () => void };
  cancelSendGesture(sessionId: string): void;
  registerSendButton(viewTag: number, enabled: boolean): void;
  unregisterSendButton(viewTag: number): void;
}

const nativeModule = requireOptionalNativeModule<NativeModelIntensitySliderModule>(
  'NativeModelIntensitySlider',
);
const NativeView: ComponentType<NativeModelIntensitySliderProps> | null = nativeModule
  ? requireNativeView<NativeModelIntensitySliderProps>(
      'NativeModelIntensitySlider',
      'NativeModelIntensitySliderView',
    )
  : null;

export const nativeModelIntensitySliderAvailable = NativeView !== null;

export function registerNativeSendButton(viewTag: number, enabled: boolean) {
  nativeModule?.registerSendButton(viewTag, enabled);
}

export function unregisterNativeSendButton(viewTag: number) {
  nativeModule?.unregisterSendButton(viewTag);
}

export function cancelNativeSendGesture(sessionId: string) {
  nativeModule?.cancelSendGesture(sessionId);
}

export function subscribeToNativeSendHoldEvents(
  eventName: NativeSendHoldEventName,
  listener: NativeSendHoldListener,
) {
  return nativeModule?.addListener(eventName, listener) ?? { remove: () => undefined };
}

export default function NativeModelIntensitySliderViewIOS(props: NativeModelIntensitySliderProps) {
  return NativeView ? <NativeView {...props} /> : <NativeModelIntensitySliderFallback {...props} />;
}
