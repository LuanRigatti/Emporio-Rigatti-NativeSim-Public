import type { ModelIntensityStep } from 'native-model-intensity-slider';

export type { ModelIntensityStep };

export const MODEL_INTENSITY_STEPS = [
  { value: 'instant', label: '5.5 Instant' },
  { value: 'medium', label: '5.6 Medium' },
  { value: 'high', label: '5.6 High' },
] as const;

export function getModelIntensityStepLabel(step: ModelIntensityStep): string {
  return MODEL_INTENSITY_STEPS.find((option) => option.value === step)?.label ?? '5.6 Medium';
}
