import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  allowsTightening,
  background,
  clipped,
  containerBackground,
  containerRelativeFrame,
  frame,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  resizable,
  scaleEffect,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

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
        widgetsDirectory?: string | null;
      }
    | null
    | undefined,
) {
  'widget';

  const safeProps = props && typeof props === 'object' ? props : undefined;
  const mode = environment?.configuration?.mode === 'retail' ? 'retail' : 'wholesale';
  const selectedDomain = mode === 'retail' ? safeProps?.retail : safeProps?.wholesale;
  const values = selectedDomain && typeof selectedDomain === 'object' ? selectedDomain : undefined;
  const financeRouteURL = safeProps?.financeRouteURL;
  const destinationURL =
    typeof financeRouteURL === 'string' && financeRouteURL.trim().length > 0
      ? `${financeRouteURL}${financeRouteURL.includes('?') ? '&' : '?'}mode=${mode}`
      : undefined;
  const sharedImageDirectory = environment?.widgetsDirectory;
  const brandImageName =
    environment?.colorScheme === 'dark'
      ? 'resumo-financeiro-splash-dark.png'
      : 'resumo-financeiro-splash-light.png';
  const brandImageURI =
    typeof sharedImageDirectory === 'string' && sharedImageDirectory.startsWith('file://')
      ? `${sharedImageDirectory.endsWith('/') ? sharedImageDirectory : `${sharedImageDirectory}/`}${brandImageName}`
      : undefined;
  const cardBackground = environment?.colorScheme === 'dark' ? '#2C2C2E' : '#F5F3F1';
  const faturamento = values?.faturamento;
  const lucroLiquido = values?.lucroLiquido;
  const faturamentoLabel =
    typeof faturamento === 'string' && faturamento.trim().length > 0 ? faturamento : '—';
  const lucroLiquidoLabel =
    typeof lucroLiquido === 'string' && lucroLiquido.trim().length > 0 ? lucroLiquido : '—';

  return (
    <VStack
      alignment="leading"
      spacing={12}
      modifiers={[
        containerBackground({ type: 'material', material: 'regular' }, 'widget'),
        ...(destinationURL ? [widgetURL(destinationURL)] : []),
      ]}
    >
      <HStack alignment="center" spacing={8}>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 15 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            lineLimit(1),
            minimumScaleFactor(0.8),
            allowsTightening(true),
          ]}
        >
          Empório Rigatti
        </Text>
        <Spacer minLength={0} />
        {brandImageURI ? (
          <Image
            uiImage={brandImageURI}
            modifiers={[resizable(), frame({ width: 32, height: 32 }), scaleEffect(2.8), clipped()]}
          />
        ) : null}
      </HStack>
      <HStack alignment="center" spacing={12}>
        <VStack
          alignment="leading"
          spacing={7}
          modifiers={[
            padding({ all: 12 }),
            containerRelativeFrame({ axes: 'horizontal', count: 2, span: 1, spacing: 12 }),
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
              font({ weight: 'bold', size: 24 }),
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
        <VStack
          alignment="leading"
          spacing={7}
          modifiers={[
            padding({ all: 12 }),
            containerRelativeFrame({ axes: 'horizontal', count: 2, span: 1, spacing: 12 }),
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
              font({ weight: 'bold', size: 24 }),
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
      </HStack>
    </VStack>
  );
}

export const resumoFinanceiroWidget = createWidget<
  ResumoFinanceiroWidgetTimelineProps,
  ResumoFinanceiroConfiguration
>('ResumoFinanceiro', ResumoFinanceiroWidget);
