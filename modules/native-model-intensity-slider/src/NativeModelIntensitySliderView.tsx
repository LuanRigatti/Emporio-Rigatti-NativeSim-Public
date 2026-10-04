export const nativeModelIntensitySliderAvailable: boolean = false;
export function registerNativeSendButton(_viewTag: number, _enabled: boolean) {}
export function unregisterNativeSendButton(_viewTag: number) {}
export function cancelNativeSendGesture(_sessionId: string) {}
export function subscribeToNativeSendHoldEvents(
  _eventName: import('./NativeModelIntensitySlider.types').NativeSendHoldEventName,
  _listener: import('./NativeModelIntensitySlider.types').NativeSendHoldListener,
) {
  return { remove: () => undefined };
}
export { default } from './NativeModelIntensitySliderFallback';
