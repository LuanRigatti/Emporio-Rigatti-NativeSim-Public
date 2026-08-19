import {
  Divider,
  Image,
  Label,
  LabeledContent,
  RNHostView,
  ScrollView,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityLabel,
  background,
  font,
  frame,
  foregroundStyle,
  monospacedDigit,
  offset,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { spacing, useAppTheme } from '@/theme';

import HomeSearchRoutePagerRN from './HomeSearchRoutePagerRN';
import HomeSearchRoutePreview from './HomeSearchRoutePreview.ios';
import type {
  HomeSearchResultVisualModel,
  HomeSearchVisualResult,
  HomeSearchVisualRow,
  HomeSearchVisualSection,
  HomeSearchVisualTone,
} from './HomeSearchResultsVisualModel';

type Props = {
  isLarge?: boolean;
  model: HomeSearchResultVisualModel;
};

const asSymbol = (value: string) => value as SFSymbol;
const monospacedLabelValues = new Set(['Início', 'Fim', 'Duração']);
const COMPACT_TITLE_OFFSET_Y = 6;

function semanticStyle(tone: HomeSearchVisualTone = 'primary') {
  if (tone === 'success') return foregroundStyle(PlatformColor('systemGreen') as unknown as string);
  if (tone === 'warning')
    return foregroundStyle(PlatformColor('systemOrange') as unknown as string);
  if (tone === 'info') return foregroundStyle(PlatformColor('systemBlue') as unknown as string);
  if (tone === 'secondary') {
    return foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  }
  return foregroundStyle({ type: 'hierarchical', style: 'primary' });
}

function ResultHeader({
  isLarge = false,
  query,
  result,
}: {
  isLarge?: boolean;
  query?: string;
  result: HomeSearchVisualResult;
}) {
  if (!result.header) return null;
  const context = result.hideQueryContext
    ? undefined
    : (result.context ?? (query !== result.header.title ? query : undefined));
  const shouldApplyCompactTitleOffset = !isLarge && !result.hideQueryContext;
  return (
    <VStack
      alignment="leading"
      spacing={spacing.xxs}
      modifiers={
        shouldApplyCompactTitleOffset ? [offset({ y: COMPACT_TITLE_OFFSET_Y })] : undefined
      }
    >
      {context ? (
        <Text
          modifiers={[
            font({ textStyle: 'footnote', design: 'rounded' }),
            semanticStyle('secondary'),
          ]}
        >
          {context}
        </Text>
      ) : null}
      {result.header.systemImage ? (
        <Label
          systemImage={asSymbol(result.header.systemImage)}
          title={result.header.title}
          modifiers={[
            font({
              textStyle: result.route ? 'subheadline' : 'headline',
              weight: 'bold',
              design: 'rounded',
            }),
            semanticStyle(),
          ]}
        />
      ) : (
        <Text
          modifiers={[
            font({
              textStyle: result.route ? 'subheadline' : 'headline',
              weight: 'bold',
              design: 'rounded',
            }),
            semanticStyle(),
          ]}
        >
          {result.header.title}
        </Text>
      )}
      {result.header.subtitle ? (
        <Text
          modifiers={[
            font({ textStyle: 'subheadline', design: 'rounded' }),
            semanticStyle('secondary'),
            padding({ leading: spacing.xxl }),
          ]}
        >
          {result.header.subtitle}
        </Text>
      ) : null}
    </VStack>
  );
}

function ResultMetric({ metric }: { metric: NonNullable<HomeSearchResultVisualModel['metric']> }) {
  return (
    <VStack alignment="leading" spacing={spacing.xxs}>
      <Text
        modifiers={[
          font({ textStyle: 'largeTitle', weight: 'bold', design: 'rounded' }),
          semanticStyle(metric.tone),
          ...(metric.monospaced ? [monospacedDigit()] : []),
        ]}
      >
        {metric.value}
      </Text>
      {metric.label ? (
        <Text
          modifiers={[
            font({ textStyle: 'subheadline', design: 'rounded' }),
            semanticStyle('secondary'),
          ]}
        >
          {metric.label}
        </Text>
      ) : null}
    </VStack>
  );
}

function ResultValueRow({ row }: { row: HomeSearchVisualRow }) {
  const monospaced = row.monospaced || monospacedLabelValues.has(row.label);
  return (
    <VStack alignment="leading" spacing={0} modifiers={[padding({ vertical: spacing.xs })]}>
      <LabeledContent
        label={
          <Text
            modifiers={[
              font({ textStyle: 'subheadline', design: 'rounded' }),
              semanticStyle('secondary'),
            ]}
          >
            {row.label}
          </Text>
        }
      >
        <Text
          modifiers={[
            font({ textStyle: 'body', weight: 'semibold', design: 'rounded' }),
            semanticStyle(row.tone),
            ...(monospaced ? [monospacedDigit()] : []),
          ]}
        >
          {row.value}
        </Text>
      </LabeledContent>
    </VStack>
  );
}

function ResultSection({
  cardBackground,
  section,
}: {
  cardBackground: string;
  section: HomeSearchVisualSection;
}) {
  const sectionContent = (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        padding({ horizontal: spacing.md, vertical: spacing.md }),
        background(
          cardBackground,
          shapes.roundedRectangle({ cornerRadius: 36, roundedCornerStyle: 'continuous' }),
        ),
      ]}
    >
      <Label
        systemImage={asSymbol(section.systemImage)}
        title={section.title}
        modifiers={[
          font({ textStyle: 'headline', weight: 'semibold', design: 'rounded' }),
          semanticStyle('secondary'),
          padding({ bottom: spacing.sm }),
        ]}
      />
      <VStack alignment="leading" spacing={0} modifiers={[padding({ bottom: spacing.sm })]}>
        {section.rows.map((row, index) => (
          <VStack key={row.id} alignment="leading" spacing={0}>
            <ResultValueRow row={row} />
            {index < section.rows.length - 1 ? <Divider /> : null}
          </VStack>
        ))}
      </VStack>
    </VStack>
  );

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={section.id === 'client-summary' ? [padding({ top: spacing.md })] : undefined}
    >
      {sectionContent}
    </VStack>
  );
}

function ResultState({ result }: { result: HomeSearchVisualResult }) {
  if (!result.state) return null;
  return (
    <VStack
      alignment="center"
      spacing={spacing.xs}
      modifiers={[
        accessibilityElement('combine'),
        accessibilityLabel(`${result.state.title}. ${result.state.description}`),
        padding({ vertical: spacing.sm }),
      ]}
    >
      <Image
        systemName={asSymbol(result.state.systemImage)}
        modifiers={[font({ textStyle: 'title2' }), semanticStyle('secondary')]}
      />
      <Text
        modifiers={[
          font({ textStyle: 'headline', weight: 'semibold', design: 'rounded' }),
          semanticStyle(),
        ]}
      >
        {result.state.title}
      </Text>
      <Text
        modifiers={[
          font({ textStyle: 'body', design: 'rounded' }),
          semanticStyle('secondary'),
          padding({ horizontal: spacing.lg }),
        ]}
      >
        {result.state.description}
      </Text>
    </VStack>
  );
}

const COMPACT_EXTRA_TOP_INSET = 20;
const COMPACT_CLIENT_EXTRA_TOP_INSET = 0;
const COMPACT_FINANCIAL_EXTRA_TOP_INSET = 4;
const SEARCH_RESULT_HORIZONTAL_INSET = 16;

function ResultContent({
  cardBackground,
  isLarge,
  query,
  result,
}: {
  cardBackground?: string;
  isLarge?: boolean;
  query?: string;
  result: HomeSearchVisualResult;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={result.route ? spacing.md : spacing.lg}
      modifiers={
        result.route ? [frame({ maxHeight: Infinity, alignment: 'topLeading' })] : undefined
      }
    >
      <ResultHeader isLarge={isLarge} query={query} result={result} />
      {result.metric ? <ResultMetric metric={result.metric} /> : null}
      {result.state ? <ResultState result={result} /> : null}
      {result.route ? (
        <HomeSearchRoutePreview isLarge={Boolean(isLarge)} sessionIds={result.route.sessionIds} />
      ) : null}
      {result.sections.map((section) => (
        <ResultSection cardBackground={cardBackground ?? ''} key={section.id} section={section} />
      ))}
    </VStack>
  );
}

const COMPACT_ROUTE_PAGER_TOP_PADDING = 20;

export default function HomeSearchResultsNative({ isLarge = false, model }: Props) {
  const { resolvedMode, theme } = useAppTheme();
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background;

  const isRouteResult =
    Boolean(model.singleDayRoute) || model.items.some((item) => Boolean(item.route));
  const isClient = Boolean(model.isClient);
  const isFinancialLayout = Boolean(model.isFinancialLayout);
  const compactTopInset = isClient
    ? COMPACT_CLIENT_EXTRA_TOP_INSET
    : isFinancialLayout
      ? COMPACT_FINANCIAL_EXTRA_TOP_INSET
      : COMPACT_EXTRA_TOP_INSET;
  const topPadding = isLarge
    ? spacing.xxl
    : isRouteResult
      ? COMPACT_ROUTE_PAGER_TOP_PADDING
      : spacing.xxl + compactTopInset;

  if (model.routePager && model.items.length > 1) {
    const pagerTopPadding = isLarge ? spacing.xxl : COMPACT_ROUTE_PAGER_TOP_PADDING;
    return (
      <VStack
        alignment="leading"
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}
      >
        <RNHostView matchContents={false}>
          <HomeSearchRoutePagerRN
            cardBackground={cardBackground}
            isLarge={isLarge}
            items={model.items}
            query={model.query}
            topPadding={pagerTopPadding}
          />
        </RNHostView>
      </VStack>
    );
  }

  const content = (
    <VStack
      alignment="leading"
      spacing={spacing.xxl}
      modifiers={[
        padding({
          horizontal: SEARCH_RESULT_HORIZONTAL_INSET,
          top: topPadding,
          bottom: spacing.xxl,
        }),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      ]}
    >
      {model.empty ? (
        <ResultState result={model} />
      ) : (
        model.items.map((result) => (
          <ResultContent
            cardBackground={cardBackground}
            isLarge={isLarge}
            key={result.id}
            query={model.query}
            result={result}
          />
        ))
      )}
    </VStack>
  );

  return (
    <ScrollView
      axes="vertical"
      modifiers={[frame({ maxHeight: Infinity, alignment: 'top' })]}
      showsIndicators
    >
      {content}
    </ScrollView>
  );
}
