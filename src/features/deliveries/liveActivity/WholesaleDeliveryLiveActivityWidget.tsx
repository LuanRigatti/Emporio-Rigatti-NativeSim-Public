import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, imageScale, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { LiveActivityContent } from './LiveActivityContracts';

function WholesaleDeliveryLiveActivity(
  props: LiveActivityContent,
  environment: LiveActivityEnvironment,
) {
  'widget';

  const [year, month, day] = props.date.split('-');
  const dateLabel = `${day}/${month}/${year}`;
  const freshnessLabel =
    props.isObsolete || environment.isStale
      ? `Dados desatualizados · ${dateLabel}`
      : `Atacado · ${dateLabel}`;

  return {
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <HStack>
          <Image systemName="shippingbox.fill" />
          <Text modifiers={[font({ weight: 'semibold' })]}>Atacado</Text>
          <Text>{dateLabel}</Text>
        </HStack>
        <HStack>
          <VStack>
            <Text modifiers={[font({ textStyle: 'caption' })]}>Baldes</Text>
            <Text modifiers={[font({ weight: 'semibold', size: 22 }), monospacedDigit()]}>
              {props.bucketCount}
            </Text>
          </VStack>
          <VStack>
            <Text modifiers={[font({ textStyle: 'caption' })]}>Entregas</Text>
            <Text modifiers={[font({ weight: 'semibold', size: 22 }), monospacedDigit()]}>
              {props.deliveryCount}
            </Text>
          </VStack>
        </HStack>
        {props.isObsolete || environment.isStale ? (
          <Text modifiers={[font({ textStyle: 'caption' })]}>{freshnessLabel}</Text>
        ) : null}
      </VStack>
    ),
    compactLeading: (
      <HStack>
        <Image systemName="shippingbox.fill" modifiers={[imageScale('small')]} />
        <Text modifiers={[monospacedDigit()]}>{props.bucketCount}</Text>
      </HStack>
    ),
    compactTrailing: (
      <HStack>
        <Image systemName="box.truck.fill" modifiers={[imageScale('small')]} />
        <Text modifiers={[monospacedDigit()]}>{props.deliveryCount}</Text>
      </HStack>
    ),
    minimal: <Image systemName="shippingbox.fill" />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Image systemName="shippingbox.fill" />
        <Text modifiers={[font({ textStyle: 'caption' })]}>Baldes</Text>
        <Text modifiers={[font({ weight: 'semibold', size: 20 }), monospacedDigit()]}>
          {props.bucketCount}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Image systemName="box.truck.fill" />
        <Text modifiers={[font({ textStyle: 'caption' })]}>Entregas</Text>
        <Text modifiers={[font({ weight: 'semibold', size: 20 }), monospacedDigit()]}>
          {props.deliveryCount}
        </Text>
      </VStack>
    ),
    expandedBottom: <Text modifiers={[font({ textStyle: 'caption' })]}>{freshnessLabel}</Text>,
  };
}

export const wholesaleDeliveryLiveActivity = createLiveActivity(
  'WholesaleDeliveryLiveActivity',
  WholesaleDeliveryLiveActivity,
);
