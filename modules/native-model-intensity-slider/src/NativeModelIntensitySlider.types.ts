import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type ModelIntensityStep = 'instant' | 'medium' | 'high';
export type ModelIntensityColorScheme = 'light' | 'dark';

export type ModelIntensityStepChangeEvent = NativeSyntheticEvent<{
  step: ModelIntensityStep;
}>;

export type ModelIntensityTransitionEvent = NativeSyntheticEvent<{
  expanded: boolean;
}>;

export type ModelIntensityInteractionCommittedEvent = NativeSyntheticEvent<{
  step: ModelIntensityStep;
}>;

export type ModelIntensityDismissRequestEvent = NativeSyntheticEvent<Record<string, never>>;
export type ModelIntensityGeometryReadyEvent = NativeSyntheticEvent<{ ready: boolean }>;
export type NativeSendPickerHostDetachedEvent = NativeSyntheticEvent<Record<string, never>>;

export type NativeSendHoldEvent = {
  sessionId: string;
  sendButtonTag: number;
};

export type NativeSendHoldCompletionEvent = {
  sessionId: string;
};

export type NativeSendHoldEventName = 'onSendHoldBegan' | 'onSendHoldCancelled';

export type NativeSendHoldListener = (
  event: NativeSendHoldEvent | NativeSendHoldCompletionEvent,
) => void;

export interface NativeModelIntensitySliderProps {
  accentColor: string;
  colorScheme: ModelIntensityColorScheme;
  expanded: boolean;
  geometryRevision?: number;
  onGeometryReady?: (event: ModelIntensityGeometryReadyEvent) => void;
  originViewTag?: number;
  onDismissRequest?: (event: ModelIntensityDismissRequestEvent) => void;
  onInteractionCommitted?: (event: ModelIntensityInteractionCommittedEvent) => void;
  onStepChange?: (event: ModelIntensityStepChangeEvent) => void;
  onTransitionComplete?: (event: ModelIntensityTransitionEvent) => void;
  selectedStep: ModelIntensityStep;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  targetViewTag?: number;
}

export interface NativeSendIntelligencePickerProps extends NativeModelIntensitySliderProps {
  interactionSessionId?: string;
  sendContentColor: string;
  sendSurfaceColor: string;
  onHostDetached?: (event: NativeSendPickerHostDetachedEvent) => void;
}
