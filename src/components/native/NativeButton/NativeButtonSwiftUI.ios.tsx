import { Button, Circle, HStack, Host, Image, Label, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityValue,
  background,
  buttonStyle,
  controlSize as controlSizeModifier,
  cornerRadius,
  disabled as disabledModifier,
  frame,
  foregroundColor,
  padding,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeButtonProps } from '@/types/native-ui';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import { roundedFont } from '../nativeTypography';

export default function NativeButtonSwiftUI({
  disabled,
  destructive,
  accessibilityHint: hint,
  accessibilityValue: value,
  color,
  backgroundColor,
  content,
  controlSize,
  horizontalPadding,
  haptic,
  label,
  minWidth,
  minHeight,
  onPress,
  systemImage,
  variant,
}: NativeButtonProps) {
  const isFilledVariant = variant === 'filled' || variant === 'surface';
  const contentWidth =
    minWidth !== undefined ? Math.max(0, minWidth - (horizontalPadding ?? 0) * 2) : undefined;
  const buttonContent =
    content?.type === 'stacked' ? (
      <VStack alignment="center" modifiers={[frame({ width: minWidth, height: minHeight })]}>
        <Text
          modifiers={[
            roundedFont({ size: 11 }),
            foregroundColor(content.foregroundColor ?? color ?? '#000000'),
          ]}
        >
          {content.title}
        </Text>
        <Text
          modifiers={[
            roundedFont({ size: 16, weight: 'semibold' }),
            foregroundColor(content.foregroundColor ?? color ?? '#000000'),
          ]}
        >
          {content.subtitle}
        </Text>
        {content.indicator ? (
          <Circle
            modifiers={[
              frame({ width: 5, height: 5 }),
              foregroundStyle(
                content.indicatorColor ?? content.foregroundColor ?? color ?? '#000000',
              ),
            ]}
          />
        ) : null}
      </VStack>
    ) : isFilledVariant ? (
      <HStack
        modifiers={contentWidth !== undefined ? [frame({ width: contentWidth })] : undefined}
        spacing={6}
      >
        <Image color={color ?? '#000000'} size={18} systemName={systemImage as SFSymbol} />
        <Text modifiers={[roundedFont({}), foregroundColor(color ?? '#000000')]}>{label}</Text>
      </HStack>
    ) : (
      <HStack modifiers={contentWidth !== undefined ? [frame({ width: contentWidth })] : undefined}>
        <Label title={label} systemImage={systemImage as SFSymbol | undefined} />
      </HStack>
    );
  const verticalPadding =
    controlSize === 'mini'
      ? 6
      : controlSize === 'small'
        ? 8
        : controlSize === 'large'
          ? 16
          : controlSize === 'extraLarge'
            ? 20
            : 12;

  return (
    <Host matchContents>
      <Button
        onPress={() => {
          triggerNativeButtonHaptic(haptic);
          onPress();
        }}
        role={destructive ? 'destructive' : 'default'}
        modifiers={[
          buttonStyle(
            isFilledVariant ? 'plain' : variant === 'primary' ? 'glassProminent' : 'glass',
          ),
          controlSizeModifier(controlSize ?? 'regular'),
          ...(disabled ? [disabledModifier(true)] : []),
          ...(isFilledVariant
            ? [
                foregroundStyle(color ?? '#000000'),
                padding({
                  horizontal: horizontalPadding ?? 16,
                  vertical: verticalPadding,
                }),
                background(backgroundColor ?? (variant === 'filled' ? '#000000' : '#FFFFFF')),
                cornerRadius(999),
              ]
            : []),
          ...(minWidth === undefined && horizontalPadding !== undefined
            ? [padding({ horizontal: horizontalPadding })]
            : []),
          ...(hint ? [accessibilityHint(hint)] : []),
          ...(value ? [accessibilityValue(value)] : []),
          roundedFont({}),
        ]}
      >
        {buttonContent}
      </Button>
    </Host>
  );
}
