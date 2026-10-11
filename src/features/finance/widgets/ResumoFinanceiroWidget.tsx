import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  allowsTightening,
  containerBackground,
  font,
  foregroundStyle,
  kerning,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
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
    { configuration?: ResumoFinanceiroConfiguration | null; date?: Date | null } | null | undefined,
) {
  'widget';

  const safeProps = props && typeof props === 'object' ? props : undefined;
  const mode = environment?.configuration?.mode === 'retail' ? 'retail' : 'wholesale';
  const selectedDomain = mode === 'retail' ? safeProps?.retail : safeProps?.wholesale;
  const values = selectedDomain && typeof selectedDomain === 'object' ? selectedDomain : undefined;
  const monthNames = [
    'JANEIRO',
    'FEVEREIRO',
    'MARÇO',
    'ABRIL',
    'MAIO',
    'JUNHO',
    'JULHO',
    'AGOSTO',
    'SETEMBRO',
    'OUTUBRO',
    'NOVEMBRO',
    'DEZEMBRO',
  ];
  const environmentDate =
    environment?.date instanceof Date && !Number.isNaN(environment.date.getTime())
      ? environment.date
      : new Date();
  const monthKeyParts =
    typeof safeProps?.monthKey === 'string' ? safeProps.monthKey.split('-') : [];
  const monthKeyYear = monthKeyParts[0];
  const monthKeyMonth = Number(monthKeyParts[1]);
  const monthKeyIsValid =
    monthKeyParts.length === 2 &&
    typeof monthKeyYear === 'string' &&
    monthKeyYear.length === 4 &&
    monthKeyYear.split('').every((digit) => digit >= '0' && digit <= '9') &&
    Number.isInteger(monthKeyMonth) &&
    monthKeyMonth >= 1 &&
    monthKeyMonth <= 12 &&
    monthKeyParts[1] === String(monthKeyMonth).padStart(2, '0');
  const providedMonthLabel = safeProps?.monthLabel;
  const normalizedProvidedMonthLabel =
    typeof providedMonthLabel === 'string' ? providedMonthLabel.trim() : '';
  const providedMonthLabelParts = normalizedProvidedMonthLabel.split(' ').filter(Boolean);
  const providedYear = providedMonthLabelParts[providedMonthLabelParts.length - 1];
  const providedMonthLabelIsComplete =
    providedMonthLabelParts.length >= 2 &&
    typeof providedYear === 'string' &&
    providedYear.length === 4 &&
    providedYear.split('').every((digit) => digit >= '0' && digit <= '9');
  const monthLabel = monthKeyIsValid
    ? `${monthNames[monthKeyMonth - 1]} ${monthKeyYear}`
    : providedMonthLabelIsComplete
      ? normalizedProvidedMonthLabel
      : `${monthNames[environmentDate.getMonth()]} ${environmentDate.getFullYear()}`;
  const financeRouteURL = safeProps?.financeRouteURL;
  const destinationURL =
    typeof financeRouteURL === 'string' && financeRouteURL.trim().length > 0
      ? `${financeRouteURL}${financeRouteURL.includes('?') ? '&' : '?'}mode=${mode}`
      : undefined;
  const faturamento = values?.faturamento;
  const lucroLiquido = values?.lucroLiquido;
  const faturamentoLabel =
    typeof faturamento === 'string' && faturamento.trim().length > 0 ? faturamento : '—';
  const lucroLiquidoLabel =
    typeof lucroLiquido === 'string' && lucroLiquido.trim().length > 0 ? lucroLiquido : '—';

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        containerBackground({ type: 'material', material: 'regular' }, 'widget'),
        ...(destinationURL ? [widgetURL(destinationURL)] : []),
      ]}
    >
      <HStack>
        <Spacer minLength={0} />
        <Text
          modifiers={[
            font({ weight: 'medium', size: 10 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            kerning(0.4),
            lineLimit(1),
            minimumScaleFactor(0.75),
            allowsTightening(true),
          ]}
        >
          {monthLabel}
        </Text>
      </HStack>
      <VStack alignment="leading" spacing={2}>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 10 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            kerning(0.9),
            lineLimit(1),
          ]}
        >
          FATURAMENTO
        </Text>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 27 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.55),
            allowsTightening(true),
          ]}
        >
          {faturamentoLabel}
        </Text>
      </VStack>
      <VStack alignment="leading" spacing={2}>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 10 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            kerning(0.9),
            lineLimit(1),
          ]}
        >
          LUCRO LÍQUIDO
        </Text>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 27 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.55),
            allowsTightening(true),
          ]}
        >
          {lucroLiquidoLabel}
        </Text>
      </VStack>
      <Spacer minLength={0} />
    </VStack>
  );
}

export const resumoFinanceiroWidget = createWidget<
  ResumoFinanceiroWidgetTimelineProps,
  ResumoFinanceiroConfiguration
>('ResumoFinanceiro', ResumoFinanceiroWidget);
