import {
  Button,
  Divider,
  HStack,
  Image,
  ScrollView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  contentShape,
  font,
  frame,
  foregroundStyle,
  padding,
  scrollIndicators,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { spacing, useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';
import { HOME_SEARCH_HELP_CATEGORIES } from './HomeSearchHelpData';
import type { SearchHelpCategory, SearchHelpExample } from './HomeSearchHelpTypes';

const asSymbol = (value: string) => value as SFSymbol;
const HELP_CARD_CORNER_RADIUS = 36;

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
          padding({ leading: spacing.xl, trailing: spacing.md, vertical: spacing.sm }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ textStyle: 'subheadline', weight: 'medium', design: 'rounded' }),
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

function HelpCategorySection({
  cardBackground,
  category,
  cornerRadius,
  onSelect,
}: {
  cardBackground: string;
  category: SearchHelpCategory;
  cornerRadius: number;
  onSelect: (query: string) => void;
}) {
  return (
    <VStack alignment="leading" spacing={spacing.xs}>
      <Text
        modifiers={[
          font({ textStyle: 'caption', weight: 'semibold', design: 'rounded' }),
          foregroundStyle(PlatformColor('secondaryLabel') as unknown as string),
          padding({ leading: spacing.sm }),
        ]}
      >
        {category.title.toUpperCase()}
      </Text>
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          background(
            cardBackground,
            shapes.roundedRectangle({
              cornerRadius,
              roundedCornerStyle: 'continuous',
            }),
          ),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {category.examples.map((example, index) => (
          <VStack
            key={example.id}
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            {index > 0 ? <Divider /> : null}
            <HelpExampleRow example={example} onSelect={onSelect} />
          </VStack>
        ))}
      </VStack>
    </VStack>
  );
}

export default function HomeSearchHelpContent({ onSelectQuery }: Props) {
  const { resolvedMode, theme } = useAppTheme();
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background;

  return (
    <ScrollView
      axes="vertical"
      modifiers={[
        scrollIndicators('automatic'),
        padding({ horizontal: 16, top: spacing.md, bottom: spacing.xxl }),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={spacing.lg}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' })]}
      >
        {HOME_SEARCH_HELP_CATEGORIES.map((category) => (
          <HelpCategorySection
            cardBackground={cardBackground}
            category={category}
            cornerRadius={HELP_CARD_CORNER_RADIUS}
            key={category.id}
            onSelect={onSelectQuery}
          />
        ))}
      </VStack>
    </ScrollView>
  );
}
