import { Button, Divider, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  contentShape,
  font,
  frame,
  foregroundStyle,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { spacing, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { HOME_SEARCH_HELP_SUGGESTIONS } from './HomeSearchHelpData';
import type { SearchHelpExample } from './HomeSearchHelpTypes';

const asSymbol = (value: string) => value as SFSymbol;
const HELP_CARD_CORNER_RADIUS = 40;

type Props = {
  onSelectQuery: (query: string) => void;
};

function HelpExampleRow({
  example,
  onSelect,
}: {
  example: SearchHelpExample;
  onSelect: (query: string) => void;
}) {
  return (
    <Button
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        accessibilityLabel(example.label),
      ]}
      onPress={() => {
        triggerLightImpactHaptic();
        onSelect(example.query);
      }}
    >
      <HStack
        spacing={spacing.sm}
        modifiers={[
          padding({ leading: spacing.xl, trailing: spacing.md, vertical: spacing.xl }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ textStyle: 'body', weight: 'medium', design: 'rounded' }),
              foregroundStyle(PlatformColor('label') as unknown as string),
            ]}
          >
            {example.label}
          </Text>
          {example.description ? (
            <Text
              modifiers={[
                font({ textStyle: 'caption', design: 'rounded' }),
                foregroundStyle(PlatformColor('secondaryLabel') as unknown as string),
              ]}
            >
              {example.description}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
        <Image color="#8B8B93" size={13} systemName={asSymbol('arrow.up.left')} />
      </HStack>
    </Button>
  );
}

export default function HomeSearchHelpContent({ onSelectQuery }: Props) {
  const { resolvedMode, theme } = useAppTheme();
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background;

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        padding({ horizontal: 16, top: spacing.xxxl + spacing.xxl, bottom: spacing.xxl }),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' })]}
      >
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            background(
              cardBackground,
              shapes.roundedRectangle({
                cornerRadius: HELP_CARD_CORNER_RADIUS,
                roundedCornerStyle: 'continuous',
              }),
            ),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {HOME_SEARCH_HELP_SUGGESTIONS.map((suggestion, index) => (
            <VStack
              key={suggestion.id}
              alignment="leading"
              spacing={0}
              modifiers={[frame({ maxWidth: Infinity })]}
            >
              {index > 0 ? <Divider /> : null}
              <HelpExampleRow example={suggestion} onSelect={onSelectQuery} />
            </VStack>
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}
