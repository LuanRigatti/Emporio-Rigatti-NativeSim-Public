import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { spacing, useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import {
  NATIVE_MODE_OPTIONS,
  type NativeModeSheetContentProps,
} from './NativeModeSheetContent.types';
import { roundedFont } from '../nativeTypography';

const asSymbol = (value: string) => value as SFSymbol;

export default function NativeModeSheetContent({ mode, onSelect }: NativeModeSheetContentProps) {
  const { theme } = useAppTheme();

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'topLeading' }),
        padding({ horizontal: spacing.md, top: spacing.sm, bottom: spacing.md }),
      ]}
    >
      <Text
        modifiers={[
          roundedFont({ size: 22, weight: 'bold' }),
          foregroundStyle(theme.colors.textPrimary),
          padding({ bottom: spacing.xs }),
        ]}
      >
        Modo de venda
      </Text>

      {NATIVE_MODE_OPTIONS.map((option) => {
        const selected = option.mode === mode;

        return (
          <Button
            key={option.mode}
            modifiers={[
              buttonStyle('plain'),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              accessibilityLabel(`${option.title}: ${option.description}`),
            ]}
            onPress={() => {
              triggerNativeButtonHaptic('light');
              onSelect(option.mode);
            }}
          >
            <HStack
              alignment="center"
              spacing={spacing.sm}
              modifiers={[
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                padding({ horizontal: spacing.sm, vertical: spacing.sm }),
                contentShape(shapes.rectangle()),
              ]}
            >
              <VStack alignment="leading" spacing={2}>
                <Text
                  modifiers={[
                    roundedFont({ size: 17, weight: 'semibold' }),
                    foregroundStyle(theme.colors.textPrimary),
                  ]}
                >
                  {option.title}
                </Text>
                <Text
                  modifiers={[
                    roundedFont({ size: 13 }),
                    foregroundStyle(theme.colors.textSecondary),
                  ]}
                >
                  {option.description}
                </Text>
              </VStack>
              <Spacer />
              {selected ? (
                <Image
                  color={theme.colors.textPrimary}
                  modifiers={[font({ size: 18, weight: 'semibold' })]}
                  size={18}
                  systemName={asSymbol('checkmark')}
                />
              ) : null}
            </HStack>
          </Button>
        );
      })}
    </VStack>
  );
}
