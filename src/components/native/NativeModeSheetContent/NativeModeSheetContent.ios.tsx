import { Button, Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { Fragment } from 'react';
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
          offset({ y: 24 }),
        ]}
      >
        Modo de venda
      </Text>

      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          background(
            theme.colors.surfaceElevated,
            shapes.roundedRectangle({
              cornerRadius: theme.radius.xl,
              roundedCornerStyle: 'continuous',
            }),
          ),
        ]}
      >
        {NATIVE_MODE_OPTIONS.map((option, index) => {
          const selected = option.mode === mode;
          const systemImages =
            option.mode === 'wholesale'
              ? { active: 'shippingbox.fill', inactive: 'shippingbox' }
              : { active: 'bag.fill', inactive: 'bag' };
          const systemImage = (selected ? systemImages.active : systemImages.inactive) as SFSymbol;

          return (
            <Fragment key={option.mode}>
              <Button
                modifiers={[
                  buttonStyle('plain'),
                  frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }),
                  contentShape(shapes.rectangle()),
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
                    frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }),
                    padding({ horizontal: spacing.md }),
                  ]}
                >
                  <Image
                    color={selected ? theme.colors.contrastSurface : theme.colors.textSecondary}
                    size={20}
                    systemName={systemImage}
                  />
                  <Text
                    modifiers={[
                      roundedFont({ size: 17, weight: 'regular' }),
                      foregroundStyle(theme.colors.textPrimary),
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Spacer />
                </HStack>
              </Button>
              {index < NATIVE_MODE_OPTIONS.length - 1 ? (
                <Divider modifiers={[padding({ leading: spacing.xxxl, trailing: spacing.md })]} />
              ) : null}
            </Fragment>
          );
        })}
      </VStack>
    </VStack>
  );
}
