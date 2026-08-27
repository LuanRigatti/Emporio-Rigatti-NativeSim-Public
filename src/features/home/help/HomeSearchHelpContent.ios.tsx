import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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
          padding({ leading: spacing.xl, trailing: spacing.md, vertical: 21 }),
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
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : '#F2EFEB';

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        padding({ horizontal: 16, top: spacing.xxxl + spacing.lg, bottom: spacing.xxl }),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' })]}
      >
        <Text
          modifiers={[
            font({ textStyle: 'headline', weight: 'semibold', design: 'rounded' }),
            foregroundStyle(PlatformColor('label') as unknown as string),
            padding({ top: 6, bottom: 10 }),
            frame({ maxWidth: Infinity, alignment: 'center' }),
          ]}
        >
          Sugestões
        </Text>
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            padding({ vertical: spacing.xxs }),
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
          {HOME_SEARCH_HELP_SUGGESTIONS.map((suggestion) => (
            <VStack
              key={suggestion.id}
              alignment="leading"
              spacing={0}
              modifiers={[frame({ maxWidth: Infinity })]}
            >
              <HelpExampleRow example={suggestion} onSelect={onSelectQuery} />
            </VStack>
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}
