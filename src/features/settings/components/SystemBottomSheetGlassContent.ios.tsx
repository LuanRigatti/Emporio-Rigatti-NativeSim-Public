import { RNHostView, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  fixedSize,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View, PlatformColor } from 'react-native';

import { useAppTheme } from '@/theme';

export default function SystemBottomSheetGlassContent() {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[padding({ horizontal: 16, top: 24, bottom: 32 }), frame({ maxWidth: Infinity })]}
    >
      <ZStack
        alignment="topLeading"
        modifiers={[fixedSize({ horizontal: true, vertical: true })]}
      >
        <RNHostView matchContents={false}>
          <View
            pointerEvents="none"
            style={[
              styles.cardSurface,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.separator,
                borderRadius: theme.radius.xl + theme.spacing.sm,
              },
              resolvedMode === 'dark' ? theme.shadows.none : theme.shadows.card,
            ]}
          />
        </RNHostView>
        <VStack
          alignment="leading"
          spacing={8}
          modifiers={[
            padding({ horizontal: 20, vertical: 22 }),
            fixedSize({ horizontal: true, vertical: true }),
          ]}
        >
          <Text>Bottom Sheet Liquid Glass</Text>
          <Text modifiers={[foregroundStyle(PlatformColor('secondaryLabel') as unknown as string)]}>
            Arraste e toque para testar a interação nativa.
          </Text>
        </VStack>
      </ZStack>
    </VStack>
  );
}

const styles = StyleSheet.create({
  cardSurface: {
    borderWidth: 0,
    flex: 1,
    width: '100%',
  },
});
