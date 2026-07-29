import { Button, Circle, HStack, Host, Image, Label, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityValue,
  background,
  buttonStyle,
  cornerRadius,
  frame,
  padding,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { NativeButtonProps } from '@/types/native-ui';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

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
        <Text color={content.foregroundColor ?? color} size={11}>
          {content.title}
        </Text>
        <Text color={content.foregroundColor ?? color} size={16} weight="semibold">
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
        <Text color={color ?? '#000000'}>{label}</Text>
      </HStack>
    ) : (
      <HStack modifiers={contentWidth !== undefined ? [frame({ width: contentWidth })] : undefined}>
        <Label title={label} systemImage={systemImage as SFSymbol | undefined} />
      </HStack>
    );

  return (
    <Host matchContents>
      <Button
        controlSize={controlSize ?? 'regular'}
        color={color}
        disabled={disabled}
        onPress={() => {
          triggerNativeButtonHaptic(haptic);
          onPress();
        }}
        role={destructive ? 'destructive' : 'default'}
        modifiers={[
          ...(isFilledVariant
            ? [
                buttonStyle('plain'),
                foregroundStyle(color ?? '#000000'),
                padding({
                  horizontal: horizontalPadding ?? 16,
                  vertical: 12,
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
        ]}
        variant={isFilledVariant ? 'plain' : variant === 'primary' ? 'glassProminent' : 'glass'}
      >
        {buttonContent}
      </Button>
    </Host>
  );
}
