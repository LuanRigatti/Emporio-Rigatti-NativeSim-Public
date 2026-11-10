import { Gauge, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import {
  controlSize,
  font,
  frame,
  fixedSize,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  padding,
  resizable,
  aspectRatio,
  foregroundStyle,
  scaleEffect,
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
  const isStale = props.isObsolete || environment.isStale;
  const freshnessLabel = `Dados desatualizados · ${dateLabel}`;
  const completedCount = Number.isFinite(props.completedDeliveryCount)
    ? Math.max(0, Math.floor(props.completedDeliveryCount))
    : 0;
  const totalCount = Number.isFinite(props.totalDeliveryCount)
    ? Math.max(0, Math.floor(props.totalDeliveryCount))
    : 0;
  const displayedCompletedCount = totalCount > 0 ? Math.min(completedCount, totalCount) : 0;
  const progress = totalCount > 0 ? displayedCompletedCount / totalCount : 0;
  const progressCountLabel = `${displayedCompletedCount}/${totalCount}`;
  const sharedImageDirectory = (
    environment as LiveActivityEnvironment & { widgetsDirectory?: string | null }
  ).widgetsDirectory;
  const liveActivityBrandMarkURI =
    typeof sharedImageDirectory === 'string' && sharedImageDirectory.startsWith('file://')
      ? `${sharedImageDirectory.endsWith('/') ? sharedImageDirectory : `${sharedImageDirectory}/`}wholesale-live-activity-mark.png`
      : undefined;

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          padding({ horizontal: 14, vertical: 20 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        <HStack
          alignment="center"
          spacing={14}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Image
            uiImage={liveActivityBrandMarkURI}
            modifiers={[
              resizable(),
              aspectRatio({ contentMode: 'fit' }),
              frame({ width: 42, height: 42 }),
            ]}
          />
          <VStack
            alignment="leading"
            spacing={4}
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
          >
            <Text
              modifiers={[
                font({ weight: 'medium', design: 'rounded', size: 11 }),
                lineLimit(1),
                fixedSize({ horizontal: true, vertical: false }),
                foregroundStyle('#FFFFFF'),
              ]}
            >
              Entregas
            </Text>
            <HStack
              alignment="center"
              spacing={8}
              modifiers={[frame({ maxWidth: Infinity })]}
            >
              <Gauge
                value={progress}
                modifiers={[
                  gaugeStyle('linearCapacity'),
                  controlSize('extraLarge'),
                  tint('#CFEDE3'),
                  frame({ maxWidth: Infinity }),
                  scaleEffect({ x: 1, y: 2 }),
                  frame({ height: 9 }),
                ]}
              />
              <Text
                modifiers={[
                  font({ weight: 'semibold', design: 'rounded', size: 12 }),
                  lineLimit(1),
                  fixedSize({ horizontal: true, vertical: false }),
                  foregroundStyle('#CFEDE3'),
                  monospacedDigit(),
                ]}
              >
                {progressCountLabel}
              </Text>
            </HStack>
          </VStack>
        </HStack>
        {isStale ? (
          <Text modifiers={[font({ textStyle: 'caption' })]}>{freshnessLabel}</Text>
        ) : null}
      </VStack>
    ),
    compactLeading: (
      <Image
        uiImage={liveActivityBrandMarkURI}
        modifiers={[resizable(), frame({ width: 25, height: 25 })]}
      />
    ),
    compactTrailing: (
      <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
        {props.deliveryCount}
      </Text>
    ),
    minimal: (
      <Image
        uiImage={liveActivityBrandMarkURI}
        modifiers={[resizable(), frame({ width: 24, height: 24 })]}
      />
    ),
    expandedCenter: (
      <HStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
          <Text
            modifiers={[
              font({ weight: 'bold', design: 'rounded', size: 34 }),
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
              font({ weight: 'bold', design: 'rounded', size: 34 }),
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
        uiImage={liveActivityBrandMarkURI}
        modifiers={[
          resizable(),
          aspectRatio({ contentMode: 'fit' }),
          frame({ width: 48, height: 48 }),
          frame({ maxWidth: Infinity, alignment: 'trailing' }),
        ]}
      />
    ),
    expandedBottom: (
      <VStack spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
        <Gauge
          value={progress}
          modifiers={[
            gaugeStyle('linearCapacity'),
            controlSize('extraLarge'),
            tint('#CFEDE3'),
            padding({ horizontal: 'default' }),
            frame({ maxWidth: Infinity }),
            scaleEffect({ x: 1, y: 2 }),
            frame({ height: 9 }),
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
