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

import { spacing } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { HOME_SEARCH_HELP_SUGGESTIONS } from './HomeSearchHelpData';
import type { SearchHelpExample } from './HomeSearchHelpTypes';

const asSymbol = (value: string) => value as SFSymbol;

type Props = {
  cardBackground?: string;
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
          padding({
            leading: spacing.xl,
            trailing: spacing.md,
            vertical: spacing.lg,
          }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ size: 18, weight: 'medium', design: 'rounded' }),
              foregroundStyle(PlatformColor('label') as unknown as string),
            ]}
          >
            {example.label}
          </Text>
          {example.description ? (
            <Text
              modifiers={[
                font({ size: 13, design: 'rounded' }),
                foregroundStyle(PlatformColor('secondaryLabel') as unknown as string),
              ]}
            >
              {example.description}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
        <Image
          color="#8B8B93"
          modifiers={[font({ size: 13, weight: 'bold' })]}
          size={13}
          systemName={asSymbol('arrow.up.left')}
        />
      </HStack>
    </Button>
  );
}

export default function HomeSearchHelpContent({
  cardBackground = 'secondarySystemGroupedBackground',
  onSelectQuery,
}: Props) {
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
        <VStack
          alignment="leading"
          spacing={spacing.xxs}
          modifiers={[
            padding({ horizontal: spacing.xxs / 2 }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 28, roundedCornerStyle: 'continuous' }),
            ),
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
