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
  const selectedDomain =
    environment?.configuration?.mode === 'retail' ? safeProps?.retail : safeProps?.wholesale;
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
  const providedMonthLabel = safeProps?.monthLabel;
  const monthLabel =
    typeof providedMonthLabel === 'string' && providedMonthLabel.trim().length > 0
      ? providedMonthLabel
      : `${monthNames[environmentDate.getMonth()]} ${environmentDate.getFullYear()}`;
  const faturamento = values?.faturamento;
  const lucroLiquido = values?.lucroLiquido;
  const faturamentoLabel =
    typeof faturamento === 'string' && faturamento.trim().length > 0 ? faturamento : '—';
  const lucroLiquidoLabel =
    typeof lucroLiquido === 'string' && lucroLiquido.trim().length > 0 ? lucroLiquido : '—';

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[containerBackground({ type: 'material', material: 'regular' }, 'widget')]}
    >
      <HStack>
        <Spacer minLength={0} />
        <Text
          modifiers={[
            font({ weight: 'medium', size: 9 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            kerning(1),
            lineLimit(1),
          ]}
        >
          {monthLabel}
        </Text>
      </HStack>
      <Spacer minLength={5} />
      <VStack alignment="leading" spacing={1}>
        <Text
          modifiers={[
            font({ weight: 'medium', size: 9 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            kerning(1.2),
            lineLimit(1),
          ]}
        >
          FATURAMENTO
        </Text>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 25 }),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.55),
            allowsTightening(true),
          ]}
        >
          {faturamentoLabel}
        </Text>
      </VStack>
      <Spacer minLength={5} />
      <VStack alignment="leading" spacing={1}>
        <Text
          modifiers={[
            font({ weight: 'medium', size: 9 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            kerning(1.2),
            lineLimit(1),
          ]}
        >
          LUCRO LÍQUIDO
        </Text>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 25 }),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.55),
            allowsTightening(true),
          ]}
        >
          {lucroLiquidoLabel}
        </Text>
      </VStack>
    </VStack>
  );
}

export const resumoFinanceiroWidget = createWidget<
  ResumoFinanceiroWidgetTimelineProps,
  ResumoFinanceiroConfiguration
>('ResumoFinanceiro', ResumoFinanceiroWidget);
