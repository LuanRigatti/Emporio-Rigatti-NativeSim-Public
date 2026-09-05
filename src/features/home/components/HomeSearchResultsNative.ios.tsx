import {
  Divider,
  HStack,
  Image,
  Label,
  LabeledContent,
  RNHostView,
  ScrollView,
  Spacer,
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

import { getCardSurfaceColor, spacing, useAppTheme } from '@/theme';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

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
  scrollable?: boolean;
};

const asSymbol = (value: string) => value as SFSymbol;
const monospacedLabelValues = new Set(['Início', 'Fim', 'Duração']);
const COMPACT_TITLE_OFFSET_Y = 6;
const SHORT_MONTH_NAMES: Record<string, string> = {
  abril: 'abr',
  agosto: 'ago',
  dezembro: 'dez',
  fevereiro: 'fev',
  janeiro: 'jan',
  julho: 'jul',
  junho: 'jun',
  março: 'mar',
  maio: 'mai',
  novembro: 'nov',
  outubro: 'out',
  setembro: 'set',
};

function isTodaySummaryQuery(query?: string): boolean {
  return query?.trim().toLowerCase() === 'resumo hoje';
}

function isSummaryQuery(query?: string): boolean {
  return query?.trim().toLowerCase().startsWith('resumo') ?? false;
}

function isCompactFinancialMetricQuery(query?: string): boolean {
  const normalized = query
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized?.startsWith('faturamento') || normalized?.startsWith('lucro liquido')
    ? true
    : false;
}

function compactTodayLabel(title: string): string {
  const match = /^(\d{1,2}) de (.+) de \d{4}$/.exec(title);
  if (!match) return `Hoje · ${title}`;
  return `Hoje · ${match[1]} ${SHORT_MONTH_NAMES[match[2]] ?? match[2]}`;
}

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
  compactFinancialMetric = false,
  compactSummary = false,
  isLarge = false,
  query,
  result,
}: {
  compactFinancialMetric?: boolean;
  compactSummary?: boolean;
  isLarge?: boolean;
  query?: string;
  result: HomeSearchVisualResult;
}) {
  const { text: maskText } = useTestModePresentation();
  if (!result.header) return null;
  if (compactSummary) {
    const [deliverySummary, revenueSummary] = result.metric?.value.split(' · ') ?? [];
    return (
      <VStack alignment="leading" spacing={spacing.sm}>
        <Text
          modifiers={[
            font({ size: 14, design: 'rounded' }),
            semanticStyle('secondary'),
            padding({ horizontal: spacing.md }),
            offset({ y: -spacing.sm }),
          ]}
        >
          {isTodaySummaryQuery(query)
            ? compactTodayLabel(result.header.title)
            : result.header.title}
        </Text>
        <HStack
          alignment="center"
          spacing={spacing.md}
          modifiers={[
            padding({ horizontal: spacing.md }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          <Text
            modifiers={[font({ size: 18, weight: 'semibold', design: 'rounded' })]}
          >
            {maskText(deliverySummary ?? '')}
          </Text>
          <Spacer />
          <Text
            modifiers={[font({ size: 18, weight: 'semibold', design: 'rounded' })]}
          >
            {maskText(revenueSummary ?? '')}
          </Text>
        </HStack>
      </VStack>
    );
  }
  if (compactFinancialMetric && result.metric) {
    return (
      <VStack alignment="leading" spacing={spacing.sm}>
        <Text
          modifiers={[
            font({ size: 14, design: 'rounded' }),
            semanticStyle('secondary'),
            padding({ horizontal: spacing.md }),
            offset({ y: -spacing.sm }),
          ]}
        >
          {result.header.title}
        </Text>
        <ResultMetric compact metric={result.metric} />
      </VStack>
    );
  }
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
          {maskText(context)}
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
          {maskText(result.header.subtitle)}
        </Text>
      ) : null}
    </VStack>
  );
}

function ResultMetric({
  compact = false,
  metric,
}: {
  compact?: boolean;
  metric: NonNullable<HomeSearchResultVisualModel['metric']>;
}) {
  const { text: maskText } = useTestModePresentation();
  return (
    <VStack alignment="leading" spacing={spacing.xxs}>
      <Text
        modifiers={[
          font(
            compact
              ? { size: 18, weight: 'semibold', design: 'rounded' }
              : { textStyle: 'largeTitle', weight: 'bold', design: 'rounded' },
          ),
          semanticStyle(metric.tone),
          ...(metric.monospaced ? [monospacedDigit()] : []),
        ]}
      >
        {maskText(metric.value)}
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

function ResultValueRow({
  neutralizeTone = false,
  row,
}: {
  neutralizeTone?: boolean;
  row: HomeSearchVisualRow;
}) {
  const { text: maskText } = useTestModePresentation();
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
            ...(neutralizeTone ? [semanticStyle()] : [semanticStyle(row.tone)]),
            ...(monospaced ? [monospacedDigit()] : []),
          ]}
        >
          {maskText(row.value)}
        </Text>
      </LabeledContent>
    </VStack>
  );
}

function ResultSection({
  cardBackground,
  neutralizeTones = false,
  section,
}: {
  cardBackground: string;
  neutralizeTones?: boolean;
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
            <ResultValueRow neutralizeTone={neutralizeTones} row={row} />
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
  neutralizeTones = false,
  query,
  result,
}: {
  cardBackground?: string;
  isLarge?: boolean;
  neutralizeTones?: boolean;
  query?: string;
  result: HomeSearchVisualResult;
}) {
  const compactSummary =
    isSummaryQuery(query) && result.sections.some((section) => section.id === 'period-financial');
  const compactFinancialMetric =
    !compactSummary &&
    isCompactFinancialMetricQuery(query) &&
    result.sections.some((section) => section.id === 'financial-context');
  const compactHeader = compactSummary || compactFinancialMetric;
  return (
    <VStack
      alignment="leading"
      spacing={result.route ? spacing.md : spacing.lg}
      modifiers={
        result.route ? [frame({ maxHeight: Infinity, alignment: 'topLeading' })] : undefined
      }
    >
      <ResultHeader
        compactFinancialMetric={compactFinancialMetric}
        compactSummary={compactSummary}
        isLarge={isLarge}
        query={query}
        result={result}
      />
      {!compactHeader && result.metric ? <ResultMetric metric={result.metric} /> : null}
      {result.state ? <ResultState result={result} /> : null}
      {result.route ? (
        <HomeSearchRoutePreview isLarge={Boolean(isLarge)} sessionIds={result.route.sessionIds} />
      ) : null}
      {result.sections.map((section) => (
        <ResultSection
          cardBackground={cardBackground ?? ''}
          key={section.id}
          neutralizeTones={neutralizeTones}
          section={section}
        />
      ))}
    </VStack>
  );
}

const COMPACT_ROUTE_PAGER_TOP_PADDING = 20;

export default function HomeSearchResultsNative({
  isLarge = false,
  model,
  scrollable = true,
}: Props) {
  const { resolvedMode } = useAppTheme();
  const cardBackground = getCardSurfaceColor(resolvedMode, '#FFFFFF');

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
        frame(
          scrollable
            ? { maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }
            : { maxWidth: Infinity, alignment: 'topLeading' },
        ),
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
            neutralizeTones={isSummaryQuery(model.query)}
            query={model.query}
            result={result}
          />
        ))
      )}
    </VStack>
  );

  return scrollable ? (
    <ScrollView
      axes="vertical"
      modifiers={[frame({ maxHeight: Infinity, alignment: 'top' })]}
      showsIndicators
    >
      {content}
    </ScrollView>
  ) : (
    content
  );
}
