import { Button, HStack, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  accessibilityValue,
  background,
  buttonBorderShape,
  buttonStyle,
  foregroundStyle,
  frame,
  offset,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { spacing, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import {
  NATIVE_MODE_OPTIONS,
  type NativeModeSheetContentProps,
} from './NativeModeSheetContent.types';
import { roundedFont } from '../nativeTypography';

export default function NativeModeSheetContent({ mode, onSelect }: NativeModeSheetContentProps) {
  const { resolvedMode, theme } = useAppTheme();
  const capsuleSurface =
    resolvedMode === 'dark' ? theme.colors.contrastSurface : theme.colors.selectionSurface;
  const capsuleContent =
    resolvedMode === 'dark' ? theme.colors.contrastContent : theme.colors.selectionContent;

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'topLeading' }),
        padding({ horizontal: spacing.md, top: spacing.xs, bottom: spacing.md }),
      ]}
    >
      <Text
        modifiers={[
          roundedFont({ size: 22, weight: 'bold' }),
          foregroundStyle(theme.colors.textPrimary),
          frame({ maxWidth: Infinity, alignment: 'center' }),
          padding({ bottom: spacing.sm }),
          offset({ y: 28 }),
        ]}
      >
        Modo de venda
      </Text>

      <HStack
        alignment="center"
        spacing={20}
        modifiers={[
          padding({ top: 64, horizontal: spacing.sm }),
          frame({ maxWidth: Infinity, alignment: 'center' }),
        ]}
      >
        {NATIVE_MODE_OPTIONS.map((option) => {
          const selected = option.mode === mode;

          return (
            <Button
              key={option.mode}
              modifiers={[
                buttonStyle('plain'),
                buttonBorderShape('capsule'),
                frame({ maxWidth: Infinity, minHeight: 44 }),
                padding({ horizontal: spacing.md, vertical: spacing.xs }),
                background(capsuleSurface, shapes.capsule()),
                foregroundStyle(capsuleContent),
                accessibilityLabel(option.title),
                accessibilityValue(selected ? 'Selecionado' : 'Não selecionado'),
              ]}
              onPress={() => {
                if (!selected) triggerLightImpactHaptic();
                onSelect(option.mode);
              }}
            >
              <Text
                modifiers={[
                  roundedFont({ size: 20, weight: 'semibold' }),
                  foregroundStyle(capsuleContent),
                ]}
              >
                {option.title}
              </Text>
            </Button>
          );
        })}
      </HStack>
    </VStack>
  );
}
