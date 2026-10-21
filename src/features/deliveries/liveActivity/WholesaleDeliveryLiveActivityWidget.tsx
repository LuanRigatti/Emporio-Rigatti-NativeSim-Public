import { Divider, Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  controlSize,
  font,
  frame,
  gaugeStyle,
  monospacedDigit,
  opacity,
  padding,
  resizable,
  foregroundStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { LiveActivityContent } from './LiveActivityContracts';

function WholesaleDeliveryLiveActivity(
  props: LiveActivityContent,
  environment: LiveActivityEnvironment,
) {
  'widget';

  const [year, month, day] = props.date.split('-');
  const dateLabel = `${day}/${month}/${year}`;
  const monthLabels = [
    'jan.',
    'fev.',
    'mar.',
    'abr.',
    'mai.',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dez.',
  ];
  const monthIndex = Number(month) - 1;
  const expandedDateLabel = `${Number(day)} ${monthLabels[monthIndex] ?? month}`;
  const completedCount = Number.isFinite(props.completedDeliveryCount)
    ? Math.max(0, Math.floor(props.completedDeliveryCount))
    : 0;
  const totalCount = Number.isFinite(props.totalDeliveryCount)
    ? Math.max(0, Math.floor(props.totalDeliveryCount))
    : 0;
  const displayedCompletedCount = totalCount > 0 ? Math.min(completedCount, totalCount) : 0;
  const progress = totalCount > 0 ? displayedCompletedCount / totalCount : 0;
  const freshnessLabel =
    props.isObsolete || environment.isStale
      ? `Dados desatualizados · ${dateLabel}`
      : `Atacado · ${dateLabel}`;
  const sharedImageDirectory = (
    environment as LiveActivityEnvironment & { widgetsDirectory?: string | null }
  ).widgetsDirectory;
  const compactBrandMarkURI =
    typeof sharedImageDirectory === 'string' && sharedImageDirectory.startsWith('file://')
      ? `${sharedImageDirectory.endsWith('/') ? sharedImageDirectory : `${sharedImageDirectory}/`}resumo-financeiro-mark-dark.png`
      : undefined;

  return {
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <HStack spacing={10}>
          <Image systemName="shippingbox.fill" />
          <Divider modifiers={[opacity(0.45)]} />
          <VStack spacing={0}>
            <Text modifiers={[font({ weight: 'semibold' })]}>Atacado</Text>
            <Text modifiers={[font({ textStyle: 'caption' })]}>{dateLabel}</Text>
          </VStack>
          <Divider modifiers={[opacity(0.45)]} />
          <HStack spacing={10}>
            <VStack spacing={0}>
              <Text modifiers={[font({ textStyle: 'caption' })]}>Baldes</Text>
              <Text modifiers={[font({ weight: 'semibold', size: 22 }), monospacedDigit()]}>
                {props.bucketCount}
              </Text>
            </VStack>
            <VStack spacing={0}>
              <Text modifiers={[font({ textStyle: 'caption' })]}>Entregas</Text>
              <Text modifiers={[font({ weight: 'semibold', size: 22 }), monospacedDigit()]}>
                {props.deliveryCount}
              </Text>
            </VStack>
          </HStack>
        </HStack>
        {props.isObsolete || environment.isStale ? (
          <Text modifiers={[font({ textStyle: 'caption' })]}>{freshnessLabel}</Text>
        ) : null}
      </VStack>
    ),
    compactLeading: (
      <Image
        uiImage={compactBrandMarkURI}
        modifiers={[resizable(), frame({ width: 25, height: 25 })]}
      />
    ),
    compactTrailing: (
      <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
        {props.deliveryCount}
      </Text>
    ),
    minimal: <Image systemName="shippingbox.fill" />,
    expandedCenter: (
      <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 34 }),
              foregroundStyle('#FFFFFF'),
              monospacedDigit(),
            ]}
          >
            {props.deliveryCount}
          </Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>Entregas</Text>
        </VStack>
        <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 34 }),
              foregroundStyle('#FFFFFF'),
              monospacedDigit(),
            ]}
          >
            {props.bucketCount}
          </Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>Baldes</Text>
        </VStack>
      </HStack>
    ),
    expandedLeading: (
      <Image
        uiImage={compactBrandMarkURI}
        modifiers={[
          resizable(),
          frame({ width: 42, height: 42 }),
          frame({ maxWidth: Infinity, alignment: 'trailing' }),
        ]}
      />
    ),
    expandedTrailing: (
      <HStack>
        <Spacer minLength={0} />
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('#8E8E93')]}>
          {expandedDateLabel}
        </Text>
      </HStack>
    ),
    expandedBottom: (
      <VStack spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
        <Gauge
          value={progress}
          modifiers={[
            gaugeStyle('linearCapacity'),
            controlSize('extraLarge'),
            tint('#0A84FF'),
            padding({ horizontal: 'default' }),
            frame({ maxWidth: Infinity }),
          ]}
        />
        <Text
          modifiers={[
            font({ textStyle: 'caption' }),
            foregroundStyle('#8E8E93'),
            monospacedDigit(),
            frame({ maxWidth: Infinity, alignment: 'center' }),
          ]}
        >
          {displayedCompletedCount} / {totalCount}
        </Text>
      </VStack>
    ),
  };
}

export const wholesaleDeliveryLiveActivity = createLiveActivity(
  'WholesaleDeliveryLiveActivity',
  WholesaleDeliveryLiveActivity,
);
