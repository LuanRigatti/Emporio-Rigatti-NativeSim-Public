import {
  Button,
  Capsule,
  Group,
  HStack,
  Host,
  Namespace,
  Rectangle,
  ScrollView,
  Text,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  Animation,
  accessibilityHidden,
  accessibilityLabel,
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  containerRelativeFrame,
  defaultScrollAnchorForRole,
  disabled,
  frame,
  fixedSize,
  font,
  foregroundStyle,
  hidden,
  matchedGeometryEffect,
  opacity,
  padding,
  scrollIndicators,
  shapes,
  zIndex,
} from '@expo/ui/swift-ui/modifiers';
import { useId } from 'react';

import { darkModeCardSurface, darkModeInsetSurface, useAppTheme } from '@/theme';

import type { NativeRetailFinanceCategorySelectorProps } from './NativeRetailFinanceCategorySelector.types';

export default function NativeRetailFinanceCategorySelectorSwiftUI({
  accessibilityLabel: label,
  contentLeadingPadding,
  contentTrailingPadding,
  fillAvailableWidth,
  items,
  itemHorizontalPadding,
  itemSpacing,
  onChange,
  scrollable = true,
  selectionAnimationMode = 'native',
  selectedKey,
  style,
}: NativeRetailFinanceCategorySelectorProps) {
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const selectionNamespaceId = useId();
  const containerSurface = resolvedMode === 'dark' ? darkModeCardSurface : theme.colors.surface;
  const selectedSurface = resolvedMode === 'dark' ? darkModeInsetSurface : theme.colors.background;
  const horizontalPadding = itemHorizontalPadding ?? 10;
  const minimumSpacing = itemSpacing ?? 10;
  const selectedIndex = items.findIndex((item) => item.key === selectedKey);
  const selectionAnimation = reduceMotionEnabled
    ? Animation.easeOut({ duration: 0.18 })
    : Animation.easeInOut({ duration: 0.22 });
  const usesSlidingBubble = selectionAnimationMode === 'slidingBubble';
  const segmentFrameModifiers = (span = 1) =>
    fillAvailableWidth
      ? [
          containerRelativeFrame({
            alignment: 'center' as const,
            axes: 'horizontal' as const,
            count: items.length,
            span,
            spacing: 0,
          }),
        ]
      : [];
  const rowModifiers = (layer: number) => [
    ...(fillAvailableWidth ? [frame({ alignment: 'leading' as const, maxWidth: Infinity })] : []),
    fillAvailableWidth
      ? padding({
          leading: contentLeadingPadding ?? 4,
          trailing: contentTrailingPadding ?? 4,
        })
      : padding({
          leading: contentLeadingPadding ?? 4,
          trailing: contentTrailingPadding ?? 12,
        }),
    zIndex(layer),
  ];
  const wholesaleSelectionIndicatorRow = (
    <HStack
      modifiers={[...rowModifiers(0), animation(selectionAnimation, selectedIndex)]}
      spacing={0}
    >
      {selectedIndex > 0 ? (
        <Rectangle
          key="finance-selector-wholesale-leading-space"
          modifiers={[
            ...segmentFrameModifiers(selectedIndex),
            frame({ height: 46 }),
            opacity(0),
            accessibilityHidden(),
          ]}
        />
      ) : null}
      {items.length > 0 ? (
        <Capsule
          key="finance-selector-wholesale-selection-bubble"
          modifiers={[
            ...segmentFrameModifiers(1),
            frame({ height: 46 }),
            foregroundStyle(selectedSurface),
          ]}
        />
      ) : null}
    </HStack>
  );
  const retailSelectionIndicatorRow = (
    <HStack
      modifiers={[...rowModifiers(0), animation(selectionAnimation, selectedIndex)]}
      spacing={minimumSpacing}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const anchorModifiers = [
          font({ textStyle: 'callout' }),
          fixedSize({ horizontal: true }),
          frame({ minHeight: 46 }),
          padding({ horizontal: horizontalPadding }),
          opacity(0),
          accessibilityHidden(),
        ];

        return (
          <Group key={item.key}>
            {selected ? (
              <Text
                key={`${item.key}-selected-anchor`}
                modifiers={[
                  ...anchorModifiers,
                  background(selectedSurface, shapes.capsule()),
                  matchedGeometryEffect('finance-selector-selection-bubble', selectionNamespaceId),
                ]}
              >
                {item.label}
              </Text>
            ) : (
              <Text key={`${item.key}-layout-anchor`} modifiers={anchorModifiers}>
                {item.label}
              </Text>
            )}
          </Group>
        );
      })}
    </HStack>
  );
  const selectionIndicatorRow = fillAvailableWidth
    ? wholesaleSelectionIndicatorRow
    : retailSelectionIndicatorRow;
  const labelButtonRow = (
    <HStack modifiers={rowModifiers(1)} spacing={fillAvailableWidth ? 0 : minimumSpacing}>
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const buttonFillsAvailableWidth = !scrollable && fillAvailableWidth;
        const button = (
          <Button
            key={item.key}
            label={item.label}
            modifiers={[
              font({ textStyle: 'callout' }),
              buttonBorderShape('capsule'),
              buttonStyle('plain'),
              ...(buttonFillsAvailableWidth ? [] : [fixedSize({ horizontal: true })]),
              ...(buttonFillsAvailableWidth ? [padding({ horizontal: horizontalPadding })] : []),
              frame(
                buttonFillsAvailableWidth
                  ? { maxWidth: Infinity, minHeight: 46 }
                  : { minHeight: 46 },
              ),
              ...(buttonFillsAvailableWidth ? [] : [padding({ horizontal: horizontalPadding })]),
              foregroundStyle(selected ? theme.colors.textPrimary : theme.colors.textSecondary),
              accessibilityLabel(`${label ?? 'Visão financeira'}: ${item.label}`),
            ]}
            onPress={() => onChange(item.key)}
          />
        );

        return fillAvailableWidth ? (
          <HStack key={item.key} modifiers={segmentFrameModifiers()}>
            {button}
          </HStack>
        ) : (
          button
        );
      })}
    </HStack>
  );
  const slidingBubbleContent = (
    <ZStack alignment="center">
      {selectionIndicatorRow}
      {labelButtonRow}
    </ZStack>
  );
  const nativeSelectionContent = (
    <HStack
      modifiers={[
        ...(fillAvailableWidth ? [frame({ alignment: 'leading', maxWidth: Infinity })] : []),
        fillAvailableWidth
          ? padding({
              leading: contentLeadingPadding ?? 4,
              trailing: contentTrailingPadding ?? 4,
            })
          : padding({
              leading: contentLeadingPadding ?? 4,
              trailing: contentTrailingPadding ?? 12,
            }),
      ]}
      spacing={fillAvailableWidth ? 0 : minimumSpacing}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        const buttonFillsAvailableWidth = !scrollable && fillAvailableWidth;
        const createButton = (buttonSelected: boolean, footprintOnly = false) => (
          <Button
            key={`${item.key}-${footprintOnly ? 'footprint' : 'option'}`}
            label={item.label}
            modifiers={[
              font({ textStyle: 'callout' }),
              buttonBorderShape('capsule'),
              buttonStyle('plain'),
              ...(buttonFillsAvailableWidth ? [] : [fixedSize({ horizontal: true })]),
              ...(buttonFillsAvailableWidth ? [padding({ horizontal: horizontalPadding })] : []),
              frame(
                buttonFillsAvailableWidth
                  ? { maxWidth: Infinity, minHeight: 46 }
                  : { minHeight: 46 },
              ),
              ...(buttonFillsAvailableWidth ? [] : [padding({ horizontal: horizontalPadding })]),
              ...(buttonSelected ? [background(selectedSurface, shapes.capsule())] : []),
              foregroundStyle(
                buttonSelected ? theme.colors.textPrimary : theme.colors.textSecondary,
              ),
              ...(footprintOnly ? [accessibilityHidden(), disabled(), hidden()] : []),
              accessibilityLabel(`${label ?? 'Visão financeira'}: ${item.label}`),
            ]}
            onPress={footprintOnly ? undefined : () => onChange(item.key)}
          />
        );

        return fillAvailableWidth ? (
          <HStack key={item.key} modifiers={segmentFrameModifiers()}>
            {createButton(selected)}
          </HStack>
        ) : (
          <ZStack alignment="center" key={item.key}>
            {createButton(true, true)}
            {createButton(selected)}
          </ZStack>
        );
      })}
    </HStack>
  );
  const content = usesSlidingBubble ? slidingBubbleContent : nativeSelectionContent;
  const contentView = fillAvailableWidth ? (
    <Group modifiers={[frame({ alignment: 'leading', maxWidth: Infinity })]}>{content}</Group>
  ) : (
    content
  );
  const selectorContent = scrollable ? (
    <ScrollView
      axes="horizontal"
      modifiers={[
        frame({ maxWidth: Infinity }),
        scrollIndicators('never', 'horizontal'),
        ...(fillAvailableWidth ? [] : [defaultScrollAnchorForRole('center', 'alignment')]),
      ]}
      showsIndicators={false}
    >
      {contentView}
    </ScrollView>
  ) : (
    contentView
  );
  const selectorFrameContent = usesSlidingBubble ? (
    <Namespace id={selectionNamespaceId}>{selectorContent}</Namespace>
  ) : (
    selectorContent
  );

  return (
    <Host ignoreSafeArea="all" style={[{ minHeight: 54, width: '100%' }, style]}>
      <HStack
        modifiers={[
          frame({ alignment: 'leading', maxWidth: Infinity }),
          padding({ horizontal: 4, vertical: 4 }),
          background(containerSurface, shapes.capsule()),
          clipShape('capsule'),
        ]}
      >
        {selectorFrameContent}
      </HStack>
    </Host>
  );
}
