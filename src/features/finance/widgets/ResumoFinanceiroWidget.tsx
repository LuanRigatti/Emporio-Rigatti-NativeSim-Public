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

import type { FinanceWidgetMode, ResumoFinanceiroWidgetProps } from './ResumoFinanceiroSnapshot';

type ResumoFinanceiroConfiguration = {
  mode: FinanceWidgetMode;
};

function ResumoFinanceiroWidget(
  props: ResumoFinanceiroWidgetProps,
  environment: { configuration: ResumoFinanceiroConfiguration },
) {
  'widget';

  const values = environment.configuration.mode === 'retail' ? props.retail : props.wholesale;

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
          {props.monthLabel}
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
          {values.faturamento ?? '—'}
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
          {values.lucroLiquido ?? '—'}
        </Text>
      </VStack>
    </VStack>
  );
}

export const resumoFinanceiroWidget = createWidget<
  ResumoFinanceiroWidgetProps,
  ResumoFinanceiroConfiguration
>('ResumoFinanceiro', ResumoFinanceiroWidget);
