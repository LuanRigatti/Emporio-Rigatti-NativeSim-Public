import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import type {
  ModelIntensityTransitionEvent,
  NativeModelIntensitySliderProps,
} from './NativeModelIntensitySlider.types';

export default function NativeModelIntensitySliderFallback({
  expanded,
  onTransitionComplete,
  style,
  testID,
}: NativeModelIntensitySliderProps) {
  const previousExpanded = useRef(expanded);

  useEffect(() => {
    if (previousExpanded.current === expanded) return;
    previousExpanded.current = expanded;
    onTransitionComplete?.({ nativeEvent: { expanded } } as ModelIntensityTransitionEvent);
  }, [expanded, onTransitionComplete]);

  if (!expanded) return null;

  return (
    <View
      accessible
      accessibilityLabel="O controle de intensidade requer uma Development Build iOS."
      pointerEvents="none"
      style={style}
      testID={testID}
    >
      <Text>Disponível em uma Development Build iOS</Text>
    </View>
  );
}
