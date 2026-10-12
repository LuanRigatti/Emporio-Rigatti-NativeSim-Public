import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  allowsTightening,
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
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
  EntregasDoDiaWidgetRow,
  EntregasDoDiaWidgetTimelineProps,
} from './EntregasDoDiaSnapshot';

function EntregasDoDiaWidget(
  props: Partial<EntregasDoDiaWidgetTimelineProps> | null | undefined,
  environment:
    | {
        colorScheme?: 'light' | 'dark';
        widgetFamily?: WidgetFamily;
        widgetsDirectory?: string | null;
      }
    | null
    | undefined,
) {
  'widget';

  const safeProps = props && typeof props === 'object' ? props : undefined;
  const isSmall = environment?.widgetFamily === 'systemSmall';
  const reportedCount =
    typeof safeProps?.deliveryCount === 'number' &&
    Number.isInteger(safeProps.deliveryCount) &&
    safeProps.deliveryCount >= 0
      ? safeProps.deliveryCount
      : null;
  const sourceRows: unknown[] = Array.isArray(safeProps?.deliveries) ? safeProps.deliveries : [];
  const visibleLimit = isSmall ? 2 : 3;
  const parsedRows = sourceRows.filter((row): row is EntregasDoDiaWidgetRow => {
    if (!row || typeof row !== 'object') return false;
    return (
      'clientName' in row &&
      'quantityLabel' in row &&
      'valueLabel' in row &&
      typeof row.clientName === 'string' &&
      typeof row.quantityLabel === 'string' &&
      typeof row.valueLabel === 'string'
    );
  });
  const availability =
    safeProps?.availability === 'available' &&
    reportedCount !== null &&
    parsedRows.length === sourceRows.length &&
    parsedRows.length === reportedCount
      ? 'available'
      : 'unavailable';
  const count = availability === 'available' && reportedCount !== null ? reportedCount : 0;
  const rows = parsedRows.slice(0, visibleLimit);
  const additionalCount = Math.max(0, count - rows.length);
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
  const cardBackground = environment?.colorScheme === 'dark' ? '#2C2C2E' : '#F5F3F1';

  const emptyMessage =
    availability === 'available' ? 'Nenhuma entrega hoje' : 'Dados de hoje indisponíveis';

  return (
    <VStack
      alignment="leading"
      spacing={isSmall ? 6 : 8}
      modifiers={[
        containerBackground({ type: 'material', material: 'regular' }, 'widget'),
        ...(routeURL ? [widgetURL(routeURL)] : []),
      ]}
    >
      <HStack
        alignment="center"
        spacing={isSmall ? 6 : 8}
        modifiers={[padding({ horizontal: isSmall ? 10 : 16 })]}
      >
        <Text
          modifiers={[
            font({ weight: 'semibold', size: isSmall ? 12 : 16 }),
            foregroundStyle({ type: 'hierarchical', style: 'primary' }),
            lineLimit(1),
            minimumScaleFactor(0.72),
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
              font({ weight: 'medium', size: 12 }),
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
        <VStack
          alignment="leading"
          spacing={5}
          modifiers={[
            padding({ all: 9 }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          <Text
            modifiers={[
              font({ weight: 'medium', size: 9 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(1),
            ]}
          >
            {availability === 'available' ? 'Entregas de hoje' : 'Entregas'}
          </Text>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <HStack key={`${row.clientName}-${index}`} alignment="center" spacing={5}>
                <VStack alignment="leading" spacing={1}>
                  <Text
                    modifiers={[
                      font({ weight: 'semibold', size: 10 }),
                      foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                      lineLimit(1),
                      minimumScaleFactor(0.6),
                    ]}
                  >
                    {row.clientName}
                  </Text>
                  <Text
                    modifiers={[
                      font({ size: 8 }),
                      foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      lineLimit(1),
                    ]}
                  >
                    {row.quantityLabel}
                  </Text>
                </VStack>
                <Spacer minLength={0} />
                <Text
                  modifiers={[
                    font({ weight: 'semibold', size: 10 }),
                    foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                    monospacedDigit(),
                    lineLimit(1),
                    minimumScaleFactor(0.55),
                  ]}
                >
                  {row.valueLabel}
                </Text>
              </HStack>
            ))
          ) : (
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
          )}
          {additionalCount > 0 ? (
            <Text
              modifiers={[
                font({ size: 8 }),
                foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
                lineLimit(1),
              ]}
            >
              +{additionalCount} entregas
            </Text>
          ) : null}
        </VStack>
      ) : (
        <VStack
          alignment="leading"
          spacing={8}
          modifiers={[
            padding({ vertical: 10, horizontal: 12 }),
            background(
              cardBackground,
              shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <HStack key={`${row.clientName}-${index}`} alignment="center" spacing={8}>
                <Image systemName="circle" color="#8E8E93" size={13} />
                <Text
                  modifiers={[
                    font({ weight: 'medium', size: 12 }),
                    foregroundStyle({ type: 'hierarchical', style: 'primary' }),
                    lineLimit(1),
                    minimumScaleFactor(0.55),
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
                    minimumScaleFactor(0.55),
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
          {additionalCount > 0 ? (
            <Text
              modifiers={[
                font({ size: 9 }),
                foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
                lineLimit(1),
              ]}
            >
              +{additionalCount} entregas
            </Text>
          ) : null}
        </VStack>
      )}
    </VStack>
  );
}

export const entregasDoDiaWidget = createWidget<EntregasDoDiaWidgetTimelineProps>(
  'EntregasDoDia',
  EntregasDoDiaWidget,
);
