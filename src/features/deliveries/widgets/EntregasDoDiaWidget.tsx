import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  allowsTightening,
  buttonStyle,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetFamily } from 'expo-widgets';

import type {
  EntregasDoDiaWidgetRow,
  EntregasDoDiaWidgetTimelineProps,
} from './EntregasDoDiaSnapshot';

function EntregasDoDiaWidget(
  props: Partial<EntregasDoDiaWidgetTimelineProps> | null | undefined,
  environment:
    | {
        colorScheme?: 'light' | 'dark';
        deliveryActionsAvailable?: boolean;
        widgetFamily?: WidgetFamily;
        widgetsDirectory?: string | null;
      }
    | null
    | undefined,
) {
  'widget';

  const safeProps = props && typeof props === 'object' ? props : undefined;
  const isSmall = environment?.widgetFamily === 'systemSmall';
  const isLarge = environment?.widgetFamily === 'systemLarge';
  const reportedCount =
    typeof safeProps?.deliveryCount === 'number' &&
    Number.isInteger(safeProps.deliveryCount) &&
    safeProps.deliveryCount >= 0
      ? safeProps.deliveryCount
      : null;
  const sourceRows: unknown[] = Array.isArray(safeProps?.deliveries) ? safeProps.deliveries : [];
  const visibleLimit = isLarge ? 8 : 3;
  const parsedRows = sourceRows.filter((row): row is EntregasDoDiaWidgetRow => {
    if (!row || typeof row !== 'object') return false;
    return (
      'id' in row &&
      'clientName' in row &&
      'quantityLabel' in row &&
      'valueLabel' in row &&
      typeof row.id === 'string' &&
      row.id.trim().length > 0 &&
      typeof row.clientName === 'string' &&
      typeof row.quantityLabel === 'string' &&
      typeof row.valueLabel === 'string' &&
      (!('completionURL' in row) || typeof row.completionURL === 'string')
    );
  });
  const structurallyComplete =
    reportedCount !== null &&
    parsedRows.length === sourceRows.length &&
    ((safeProps?.state === 'pending' && reportedCount > 0 && parsedRows.length === reportedCount) ||
      ((safeProps?.state === 'all_completed' || safeProps?.state === 'empty') &&
        reportedCount === 0 &&
        parsedRows.length === 0) ||
      (safeProps?.state === 'unavailable' && reportedCount === 0 && parsedRows.length === 0));
  const state = structurallyComplete ? safeProps?.state : 'unavailable';
  const rows = state === 'pending' ? parsedRows.slice(0, visibleLimit) : [];
  const routeURL =
    typeof safeProps?.deliveryRouteURL === 'string' && safeProps.deliveryRouteURL.trim()
      ? safeProps.deliveryRouteURL
      : undefined;
  const directory = environment?.widgetsDirectory;
  const markName =
    environment?.colorScheme === 'dark'
      ? 'resumo-financeiro-mark-dark.png'
      : 'resumo-financeiro-mark-light.png';
  const markURI =
    typeof directory === 'string' && directory.startsWith('file://')
      ? `${directory.endsWith('/') ? directory : `${directory}/`}${markName}`
      : undefined;
  const emptyMessage =
    state === 'all_completed'
      ? 'Todas as entregas concluídas'
      : state === 'empty'
        ? 'Nenhuma entrega hoje'
        : 'Dados de hoje indisponíveis';

  const completionControl = (row: EntregasDoDiaWidgetRow) => {
    if (environment?.deliveryActionsAvailable === true) {
      return (
        <Button
          target={`rigatti-delivery-complete:${safeProps?.date}:${encodeURIComponent(row.id)}`}
          modifiers={[buttonStyle('plain'), frame({ width: 34, height: 34 })]}
        >
          <Image systemName="circle" color="#8E8E93" size={20} />
        </Button>
      );
    }

    if (environment?.deliveryActionsAvailable === false && (row.completionURL || routeURL)) {
      return (
        <Link
          destination={row.completionURL || routeURL || ''}
          modifiers={[frame({ width: 34, height: 34 })]}
        >
          <Image systemName="circle" color="#8E8E93" size={20} />
        </Link>
      );
    }

    return <Image systemName="circle" color="#8E8E93" size={20} />;
  };

  return (
    <VStack
      alignment="leading"
      spacing={isSmall || isLarge ? 2 : 10}
      modifiers={[
        containerBackground({ type: 'material', material: 'regular' }, 'widget'),
        ...(routeURL ? [widgetURL(routeURL)] : []),
      ]}
    >
      <HStack
        alignment="center"
        spacing={isSmall ? 4 : 6}
        modifiers={[padding(isSmall ? { horizontal: 2 } : { top: 6, leading: 22, trailing: 16 })]}
      >
        <Text
          modifiers={[
            font({ weight: 'semibold', size: isSmall ? 12 : 15 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            lineLimit(1),
            minimumScaleFactor(0.78),
            allowsTightening(true),
          ]}
        >
          Empório Rigatti
        </Text>
        {!isSmall ? (
          <Text
            modifiers={[
              font({ weight: 'medium', size: 11 }),
              foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
              lineLimit(1),
            ]}
          >
            •
          </Text>
        ) : null}
        {!isSmall ? (
          <Text
            modifiers={[
              font({ weight: 'medium', size: 11 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(1),
              minimumScaleFactor(0.8),
            ]}
          >
            Entregas
          </Text>
        ) : null}
        <Spacer minLength={0} />
        {markURI ? (
          <Image
            uiImage={markURI}
            modifiers={[
              resizable(),
              frame({ width: isSmall ? 22 : 32, height: isSmall ? 22 : 32 }),
            ]}
          />
        ) : (
          <Spacer modifiers={[frame({ width: isSmall ? 22 : 32, height: isSmall ? 22 : 32 })]} />
        )}
      </HStack>

      {isSmall ? (
        <VStack alignment="leading" spacing={0} modifiers={[padding({ horizontal: 2 })]}>
          {rows.length > 0 ? <Spacer minLength={0} /> : null}
          {rows.flatMap((row, index) => [
            ...(index > 0 ? [<Spacer key={`gap-${row.id}`} minLength={0} />] : []),
            <HStack key={row.id} alignment="center" spacing={4}>
              {completionControl(row)}
              <Text
                modifiers={[
                  font({ weight: 'semibold', size: 12 }),
                  foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                  lineLimit(1),
                  minimumScaleFactor(0.72),
                  allowsTightening(true),
                ]}
              >
                {row.clientName} · {row.quantityLabel}
              </Text>
            </HStack>,
          ])}
          {rows.length > 0 ? <Spacer minLength={0} /> : null}
          {rows.length === 0 ? (
            <Text
              modifiers={[
                font({ weight: 'medium', size: 10 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                lineLimit(2),
                minimumScaleFactor(0.8),
              ]}
            >
              {emptyMessage}
            </Text>
          ) : null}
        </VStack>
      ) : (
        <VStack
          alignment="leading"
          spacing={isLarge ? 0 : 4}
          modifiers={[padding({ leading: 12, trailing: 16 })]}
        >
          {rows.length > 0 ? (
            rows.map((row) => (
              <HStack key={row.id} alignment="center" spacing={6}>
                {completionControl(row)}
                <Text
                  modifiers={[
                    font({ weight: 'medium', size: 15 }),
                    foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                    lineLimit(1),
                    minimumScaleFactor(0.68),
                    allowsTightening(true),
                  ]}
                >
                  {row.clientName} · {row.quantityLabel}
                </Text>
                <Spacer minLength={4} />
                <Text
                  modifiers={[
                    font({ weight: 'semibold', size: 12 }),
                    foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                    monospacedDigit(),
                    lineLimit(1),
                    minimumScaleFactor(0.68),
                    allowsTightening(true),
                  ]}
                >
                  {row.valueLabel}
                </Text>
              </HStack>
            ))
          ) : (
            <Text
              modifiers={[
                font({ weight: 'medium', size: 12 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                lineLimit(2),
              ]}
            >
              {emptyMessage}
            </Text>
          )}
        </VStack>
      )}
      {!isSmall ? <Spacer minLength={0} /> : null}
    </VStack>
  );
}

export const entregasDoDiaWidget = createWidget<EntregasDoDiaWidgetTimelineProps>(
  'EntregasDoDia',
  EntregasDoDiaWidget,
);
