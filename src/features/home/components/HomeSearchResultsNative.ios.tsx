import {
  Divider,
  Image,
  Label,
  LabeledContent,
  ScrollView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityLabel,
  background,
  clipped,
  font,
  frame,
  foregroundStyle,
  monospacedDigit,
  onGeometryChange,
  padding,
  scrollIndicators,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { PlatformColor } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { spacing, useAppTheme } from '@/theme';
import { NativeInteractivePager, NativeInteractivePagerPage } from '@/components/native';
import type { NativeInteractivePagerGeometryEvent } from '@/components/native';

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

function logHomeSearchGeometry(
  scope: 'home-single' | 'home-multiple',
  layer: string,
  frame: { x: number; y: number; width: number; height: number },
) {
  if (!__DEV__) return;
  console.log('[bottom-sheet-geometry]', {
    height: frame.height,
    layer,
    scope,
    timestampMs: Date.now(),
    width: frame.width,
    x: frame.x,
    y: frame.y,
  });
}

function logNativePagerGeometry(event: NativeInteractivePagerGeometryEvent) {
  if (!__DEV__) return;
  console.log('[bottom-sheet-geometry]', {
    ...event.nativeEvent,
    layer: `native-${event.nativeEvent.layer}`,
    scope: 'home-multiple',
    timestampMs: Date.now(),
  });
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

function ResultHeader({ query, result }: { query?: string; result: HomeSearchVisualResult }) {
  if (!result.header) return null;
  const context = result.hideQueryContext
    ? undefined
    : (result.context ?? (query !== result.header.title ? query : undefined));
  return (
    <VStack alignment="leading" spacing={spacing.xxs}>
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
      <Label
        systemImage={asSymbol(result.header.systemImage)}
        title={result.header.title}
        modifiers={[
          font({ textStyle: 'title2', weight: 'bold', design: 'rounded' }),
          semanticStyle(),
        ]}
      />
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

function ResultContent({
  isLarge,
  cardBackground,
  query,
  result,
}: {
  cardBackground: string;
  isLarge: boolean;
  query?: string;
  result: HomeSearchVisualResult;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={spacing.lg}
      modifiers={
        result.route ? [frame({ maxHeight: Infinity, alignment: 'topLeading' })] : undefined
      }
    >
      <ResultHeader query={query} result={result} />
      {result.metric ? <ResultMetric metric={result.metric} /> : null}
      {result.state ? <ResultState result={result} /> : null}
      {result.route ? (
        <HomeSearchRoutePreview isLarge={isLarge} sessionIds={result.route.sessionIds} />
      ) : null}
      {result.sections.map((section) => (
        <ResultSection cardBackground={cardBackground} key={section.id} section={section} />
      ))}
    </VStack>
  );
}

export default function HomeSearchResultsNative({ isLarge = false, model }: Props) {
  const { resolvedMode, theme } = useAppTheme();
  const cardBackground = resolvedMode === 'dark' ? theme.colors.surface : theme.colors.background;
  const diagnosticScope = model.routePager ? 'home-multiple' : 'home-single';
  const shouldEnableScroll = isLarge && model.items.length > 1 && !model.routePager;
  const content = (
    <VStack
      alignment="leading"
      spacing={spacing.xxl}
      modifiers={[
        padding({ horizontal: spacing.xl, top: spacing.xxl, bottom: spacing.xxl }),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        onGeometryChange((frame) =>
          logHomeSearchGeometry(diagnosticScope, 'results-content', frame),
        ),
      ]}
    >
      {model.empty ? (
        <ResultState result={model} />
      ) : model.routePager ? (
        <VStack
          alignment="leading"
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'topLeading' }),
            onGeometryChange((frame) =>
              logHomeSearchGeometry(diagnosticScope, 'route-pager-container', frame),
            ),
          ]}
        >
          <NativeInteractivePager fillWidth onGeometry={logNativePagerGeometry}>
            {model.items.map((result, index) => (
              <NativeInteractivePagerPage key={result.id} page={index}>
                <VStack
                  alignment="leading"
                  modifiers={[
                    frame({ maxWidth: Infinity, alignment: 'topLeading' }),
                    padding({ horizontal: spacing.sm }),
                    scrollIndicators('hidden', 'both'),
                    onGeometryChange((frame) =>
                      logHomeSearchGeometry(diagnosticScope, 'route-page-content', frame),
                    ),
                  ]}
                >
                  <ResultContent
                    cardBackground={cardBackground}
                    isLarge={isLarge}
                    query={model.query}
                    result={result}
                  />
                </VStack>
              </NativeInteractivePagerPage>
            ))}
          </NativeInteractivePager>
        </VStack>
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

  if (!shouldEnableScroll) {
    return (
      <ZStack
        alignment="topLeading"
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
          clipped(),
          onGeometryChange((frame) =>
            logHomeSearchGeometry(diagnosticScope, 'results-viewport', frame),
          ),
        ]}
      >
        <Spacer />
        {content}
      </ZStack>
    );
  }

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
