import { Button, Host, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  foregroundStyle,
  frame,
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { type StyleProp, type ViewStyle } from 'react-native';

type SystemLiquidGlassExperimentProps = {
  color: string;
  cornerRadius: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
  width: number;
};

export default function SystemLiquidGlassExperiment({
  color,
  cornerRadius,
  onPress,
  style,
  title = 'Teste Liquid Glass',
  width,
}: SystemLiquidGlassExperimentProps) {
  return (
    <Host matchContents style={style}>
      <Button
        modifiers={[
          buttonStyle('plain'),
          padding({ horizontal: 18, vertical: 14 }),
          frame({ alignment: 'leading', height: 56, width }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            cornerRadius,
            shape: 'roundedRectangle',
          }),
          accessibilityLabel(title),
        ]}
        onPress={onPress}
      >
        <Text modifiers={[foregroundStyle(color)]}>{title}</Text>
      </Button>
    </Host>
  );
}
