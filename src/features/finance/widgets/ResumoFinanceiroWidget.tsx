import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  allowsTightening,
  background,
  containerBackground,
  containerRelativeFrame,
  frame,
  font,
  foregroundStyle,
  kerning,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  resizable,
  shapes,
  unredacted,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetFamily } from 'expo-widgets';

import type {
  FinanceWidgetMode,
  ResumoFinanceiroWidgetTimelineProps,
} from './ResumoFinanceiroSnapshot';

type ResumoFinanceiroConfiguration = {
  mode: FinanceWidgetMode;
  diagnosticVariant?:
    | 'full'
    | 'without_image'
    | 'static_test'
    | 'previous_layout'
    | 'redaction'
    | 'redaction_unredacted';
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
  const configuredVariant = environment?.configuration?.diagnosticVariant;
  const diagnosticVariant =
    configuredVariant === 'without_image' ||
    configuredVariant === 'static_test' ||
    configuredVariant === 'previous_layout' ||
    configuredVariant === 'redaction' ||
    configuredVariant === 'redaction_unredacted'
      ? configuredVariant
      : 'full';
  const financeRouteURL = safeProps?.financeRouteURL;
  const destinationURL =
    typeof financeRouteURL === 'string' && financeRouteURL.trim().length > 0
      ? `${financeRouteURL}${financeRouteURL.includes('?') ? '&' : '?'}mode=${mode}`
      : undefined;
  if (diagnosticVariant === 'static_test') {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          containerBackground({ type: 'material', material: 'regular' }, 'widget'),
          ...(destinationURL ? [widgetURL(destinationURL)] : []),
        ]}
      >
        <Text modifiers={[font({ weight: 'bold', size: 17 }), lineLimit(1)]}>
          DIAGNÓSTICO C · TESTE
        </Text>
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>
          FATURAMENTO FICTÍCIO · R$ 123,45
        </Text>
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>
          LUCRO FICTÍCIO · R$ 67,89
        </Text>
        <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>DADOS INVENTADOS PARA TESTE</Text>
      </VStack>
    );
  }

  if (diagnosticVariant === 'redaction' || diagnosticVariant === 'redaction_unredacted') {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          containerBackground({ type: 'material', material: 'regular' }, 'widget'),
          ...(destinationURL ? [widgetURL(destinationURL)] : []),
          ...(diagnosticVariant === 'redaction_unredacted' ? [unredacted()] : []),
        ]}
      >
        <Text modifiers={[font({ weight: 'bold', size: 17 }), lineLimit(1)]}>
          DIAGNÓSTICO E · REDACTION
        </Text>
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>
          TEXTO ESTÁTICO NÃO SENSÍVEL
        </Text>
        <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>SEM DADOS FINANCEIROS</Text>
      </VStack>
    );
  }

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

  if (diagnosticVariant === 'previous_layout') {
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
    const oldMonthLabel = monthKeyIsValid
      ? `${monthNames[monthKeyMonth - 1]} ${monthKeyYear}`
      : providedMonthLabelIsComplete
        ? normalizedProvidedMonthLabel
        : `${monthNames[environmentDate.getMonth()]} ${environmentDate.getFullYear()}`;

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
            {oldMonthLabel}
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
          {diagnosticVariant === 'full' && brandImageURI ? (
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
      <HStack alignment="center" spacing={6} modifiers={[padding({ leading: 22, trailing: 16 })]}>
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
        {diagnosticVariant === 'full' && brandImageURI ? (
          <Image
            uiImage={brandImageURI}
            modifiers={[resizable(), frame({ width: 32, height: 32 })]}
          />
        ) : (
          <Spacer modifiers={[frame({ width: 32, height: 32 })]} />
        )}
      </HStack>
      <HStack alignment="center" spacing={12}>
        <VStack
          alignment="leading"
          spacing={5}
          modifiers={[
            padding({ vertical: 9, horizontal: 12 }),
            containerRelativeFrame({ axes: 'horizontal', count: 2, span: 1, spacing: 28 }),
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
          spacing={5}
          modifiers={[
            padding({ vertical: 9, horizontal: 12 }),
            containerRelativeFrame({ axes: 'horizontal', count: 2, span: 1, spacing: 28 }),
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
