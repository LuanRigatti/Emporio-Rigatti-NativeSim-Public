import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  allowsTightening,
  background,
  containerBackground,
  frame,
  font,
  foregroundStyle,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  resizable,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetFamily } from 'expo-widgets';

import type {
  FinanceWidgetMode,
  ResumoFinanceiroWidgetTimelineProps,
} from './ResumoFinanceiroSnapshot';

type ResumoFinanceiroConfiguration = {
  mode: FinanceWidgetMode;
};

function ResumoFinanceiroWidget(
  props: Partial<ResumoFinanceiroWidgetTimelineProps> | null | undefined,
  environment:
    | {
        configuration?: ResumoFinanceiroConfiguration | null;
        colorScheme?: 'light' | 'dark';
        date?: Date | null;
        widgetFamily?: WidgetFamily;
        widgetsDirectory?: string | null;
      }
    | null
    | undefined,
) {
  'widget';

  const safeProps = props && typeof props === 'object' ? props : undefined;
  const mode = environment?.configuration?.mode === 'retail' ? 'retail' : 'wholesale';
  const financeRouteURL = safeProps?.financeRouteURL;
  const destinationURL =
    typeof financeRouteURL === 'string' && financeRouteURL.trim().length > 0
      ? `${financeRouteURL}${financeRouteURL.includes('?') ? '&' : '?'}mode=${mode}`
      : undefined;
  const selectedDomain = mode === 'retail' ? safeProps?.retail : safeProps?.wholesale;
  const values = selectedDomain && typeof selectedDomain === 'object' ? selectedDomain : undefined;
  const faturamento = values?.faturamento;
  const lucroLiquido = values?.lucroLiquido;
  const faturamentoLabel =
    typeof faturamento === 'string' && faturamento.trim().length > 0 ? faturamento : '—';
  const lucroLiquidoLabel =
    typeof lucroLiquido === 'string' && lucroLiquido.trim().length > 0 ? lucroLiquido : '—';
  const suppliedMonthLabel =
    typeof safeProps?.monthLabel === 'string' ? safeProps.monthLabel.trim() : '';
  const monthNames = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  const environmentDate =
    environment?.date instanceof Date && !Number.isNaN(environment.date.getTime())
      ? environment.date
      : new Date();
  const rawMonthLabel =
    suppliedMonthLabel ||
    `${monthNames[environmentDate.getMonth()]} ${environmentDate.getFullYear()}`;
  const normalizedMonthLabel = rawMonthLabel.toLowerCase();
  const mediumMonthLabel = `${normalizedMonthLabel.charAt(0).toUpperCase()}${normalizedMonthLabel.slice(1)}`;

  const sharedImageDirectory = environment?.widgetsDirectory;
  const brandImageName =
    environment?.colorScheme === 'dark'
      ? 'resumo-financeiro-mark-dark.png'
      : 'resumo-financeiro-mark-light.png';
  const brandImageURI =
    typeof sharedImageDirectory === 'string' && sharedImageDirectory.startsWith('file://')
      ? `${sharedImageDirectory.endsWith('/') ? sharedImageDirectory : `${sharedImageDirectory}/`}${brandImageName}`
      : undefined;
  const cardBackground = environment?.colorScheme === 'dark' ? '#2C2C2E' : '#F5F3F1';

  if (environment?.widgetFamily === 'systemSmall') {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          containerBackground({ type: 'material', material: 'regular' }, 'widget'),
          ...(destinationURL ? [widgetURL(destinationURL)] : []),
        ]}
      >
        <HStack alignment="center" spacing={4} modifiers={[padding({ horizontal: 2 })]}>
          <Text
            modifiers={[
              font({ weight: 'semibold', size: 12 }),
              foregroundStyle({ type: 'hierarchical', style: 'primary' }),
              lineLimit(1),
              minimumScaleFactor(0.75),
              allowsTightening(true),
            ]}
          >
            Empório Rigatti
          </Text>
          <Spacer minLength={0} />
          {brandImageURI ? (
            <Image
              uiImage={brandImageURI}
              modifiers={[resizable(), frame({ width: 22, height: 22 })]}
            />
          ) : (
            <Spacer modifiers={[frame({ width: 22, height: 22 })]} />
          )}
        </HStack>
        <VStack
          alignment="leading"
          spacing={7}
          modifiers={[
            padding({ all: 12 }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[
                font({ weight: 'medium', size: 9 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                lineLimit(1),
              ]}
            >
              Faturamento
            </Text>
            <Text
              modifiers={[
                font({ weight: 'bold', size: 18 }),
                foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                monospacedDigit(),
                lineLimit(1),
                minimumScaleFactor(0.42),
                allowsTightening(true),
              ]}
            >
              {faturamentoLabel}
            </Text>
          </VStack>
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[
                font({ weight: 'medium', size: 9 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                lineLimit(1),
              ]}
            >
              Lucro líquido
            </Text>
            <Text
              modifiers={[
                font({ weight: 'bold', size: 18 }),
                foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                monospacedDigit(),
                lineLimit(1),
                minimumScaleFactor(0.42),
                allowsTightening(true),
              ]}
            >
              {lucroLiquidoLabel}
            </Text>
          </VStack>
        </VStack>
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        containerBackground({ type: 'material', material: 'regular' }, 'widget'),
        ...(destinationURL ? [widgetURL(destinationURL)] : []),
      ]}
    >
      <HStack
        alignment="center"
        spacing={6}
        modifiers={[padding({ top: 4, leading: 22, trailing: 16 })]}
      >
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 15 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            lineLimit(1),
            minimumScaleFactor(0.78),
            allowsTightening(true),
          ]}
        >
          Empório Rigatti
        </Text>
        <Text
          modifiers={[
            font({ weight: 'medium', size: 11 }),
            foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
            lineLimit(1),
          ]}
        >
          •
        </Text>
        <Text
          modifiers={[
            font({ weight: 'medium', size: 11 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
            minimumScaleFactor(0.82),
            allowsTightening(true),
            layoutPriority(1),
          ]}
        >
          {mediumMonthLabel}
        </Text>
        <Spacer minLength={0} />
        {brandImageURI ? (
          <Image
            uiImage={brandImageURI}
            modifiers={[resizable(), frame({ width: 32, height: 32 })]}
          />
        ) : (
          <Spacer modifiers={[frame({ width: 32, height: 32 })]} />
        )}
      </HStack>
      <HStack alignment="center" spacing={0}>
        <Spacer minLength={0} />
        <VStack
          alignment="leading"
          spacing={5}
          modifiers={[
            padding({ vertical: 9, horizontal: 12 }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          <Text
            modifiers={[
              font({ weight: 'medium', size: 11 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(1),
            ]}
          >
            Faturamento
          </Text>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 22 }),
              foregroundStyle({ type: 'hierarchical', style: 'primary' }),
              monospacedDigit(),
              lineLimit(1),
              minimumScaleFactor(0.52),
              allowsTightening(true),
            ]}
          >
            {faturamentoLabel}
          </Text>
        </VStack>
        <Spacer minLength={12} />
        <VStack
          alignment="leading"
          spacing={5}
          modifiers={[
            padding({ vertical: 9, horizontal: 12 }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          <Text
            modifiers={[
              font({ weight: 'medium', size: 11 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(1),
            ]}
          >
            Lucro líquido
          </Text>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 22 }),
              foregroundStyle({ type: 'hierarchical', style: 'primary' }),
              monospacedDigit(),
              lineLimit(1),
              minimumScaleFactor(0.52),
              allowsTightening(true),
            ]}
          >
            {lucroLiquidoLabel}
          </Text>
        </VStack>
        <Spacer minLength={0} />
      </HStack>
    </VStack>
  );
}

export const resumoFinanceiroWidget = createWidget<
  ResumoFinanceiroWidgetTimelineProps,
  ResumoFinanceiroConfiguration
>('ResumoFinanceiro', ResumoFinanceiroWidget);
