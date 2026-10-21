import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';
import {
  accessibilityLabel,
  accessibilityValue,
  background,
  buttonStyle,
  contentShape,
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
  const { theme } = useAppTheme();

  return (
    <VStack
      alignment="leading"
      spacing={spacing.xxl}
      modifiers={[
        padding({ horizontal: spacing.md, top: spacing.xs, bottom: spacing.md }),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      ]}
    >
      <Text
        modifiers={[
          roundedFont({ size: 22, weight: 'bold' }),
          foregroundStyle(theme.colors.textPrimary),
          frame({ maxWidth: Infinity, alignment: 'center' }),
          padding({ bottom: spacing.sm }),
          offset({ y: 24 }),
        ]}
      >
        Modo de venda
      </Text>

      <VStack
        alignment="leading"
        spacing={spacing.sm}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' })]}
      >
        {NATIVE_MODE_OPTIONS.map((option) => {
          const selected = option.mode === mode;
          const systemImages =
            option.mode === 'wholesale'
              ? { active: 'shippingbox.fill', inactive: 'shippingbox' }
              : { active: 'bag.fill', inactive: 'bag' };
          const systemImage = (selected ? systemImages.active : systemImages.inactive) as SFSymbol;
          const cardShape = shapes.roundedRectangle({
            cornerRadius: theme.radius.xl,
            roundedCornerStyle: 'continuous',
          });

          return (
            <Button
              key={option.mode}
              modifiers={[
                buttonStyle('plain'),
                frame({
                  maxWidth: Infinity,
                  minHeight: 72,
                  alignment: 'center',
                }),
                accessibilityLabel(option.title),
                accessibilityValue(selected ? 'Selecionado' : 'Não selecionado'),
              ]}
              onPress={() => {
                if (!selected) triggerLightImpactHaptic();
                onSelect(option.mode);
              }}
            >
              <HStack
                alignment="center"
                spacing={spacing.sm}
                modifiers={[
                  frame({
                    maxWidth: Infinity,
                    minHeight: 72,
                    alignment: 'leading',
                  }),
                  padding({ horizontal: spacing.md }),
                  contentShape(cardShape),
                  background(theme.colors.surfaceElevated, cardShape),
                ]}
              >
                <Image
                  color={selected ? theme.colors.contrastSurface : theme.colors.textSecondary}
                  size={20}
                  systemName={systemImage}
                />
                <Text
                  modifiers={[
                    roundedFont({ textStyle: 'body', weight: 'regular' }),
                    foregroundStyle(theme.colors.textPrimary),
                  ]}
                >
                  {option.title}
                </Text>
                <Spacer />
              </HStack>
            </Button>
          );
        })}
      </VStack>
    </VStack>
  );
}
