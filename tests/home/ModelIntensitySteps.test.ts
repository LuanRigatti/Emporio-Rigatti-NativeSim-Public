import {
  getModelIntensityStepLabel,
  MODEL_INTENSITY_STEPS,
} from '@/features/home/components/chatgpt-attachments/composer/model-intensity-steps';

describe('Model intensity prototype steps', () => {
  it('starts at Medium and exposes the three requested semantic values in order', () => {
    expect(MODEL_INTENSITY_STEPS).toEqual([
      { value: 'instant', label: '5.5 Instant' },
      { value: 'medium', label: '5.6 Medium' },
      { value: 'high', label: '5.6 High' },
    ]);
    expect(getModelIntensityStepLabel('medium')).toBe('5.6 Medium');
  });

  it('keeps each semantic selection local to the intensity prototype', () => {
    expect(getModelIntensityStepLabel('instant')).toBe('5.5 Instant');
    expect(getModelIntensityStepLabel('high')).toBe('5.6 High');
  });
});
