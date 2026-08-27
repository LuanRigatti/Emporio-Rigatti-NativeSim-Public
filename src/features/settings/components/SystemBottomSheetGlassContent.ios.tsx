import { Button, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  foregroundStyle,
  frame,
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';

const SHEET_GLASS_CORNER_RADIUS = 24;

export default function SystemBottomSheetGlassContent() {
  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ horizontal: 16, top: 24, bottom: 32 }), frame({ maxWidth: Infinity })]}
    >
      <Button
        modifiers={[
          buttonStyle('plain'),
          padding({ horizontal: 20, vertical: 22 }),
          frame({ alignment: 'leading', maxWidth: Infinity, minHeight: 140 }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            cornerRadius: SHEET_GLASS_CORNER_RADIUS,
            shape: 'roundedRectangle',
          }),
          accessibilityLabel('Bottom Sheet Liquid Glass'),
        ]}
        onPress={() => undefined}
      >
        <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text>Bottom Sheet Liquid Glass</Text>
          <Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel') as unknown as string)]}>
            Arraste e toque para testar a interação nativa.
          </Text>
        </VStack>
      </Button>
    </VStack>
  );
}
