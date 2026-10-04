import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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
          <Spacer minLength={0} />
          <VStack spacing={0}>
            <Text modifiers={[font({ weight: 'semibold' })]}>Atacado</Text>
            <Text modifiers={[font({ textStyle: 'caption' })]}>{dateLabel}</Text>
          </VStack>
          <Spacer minLength={0} />
          <HStack>
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
      <HStack>
        <Image systemName="shippingbox.fill" modifiers={[imageScale('small')]} />
        <Text modifiers={[monospacedDigit()]}>{props.bucketCount}</Text>
      </HStack>
    ),
    compactTrailing: (
      <HStack>
        <Image systemName="checklist" modifiers={[imageScale('small')]} />
        <Text modifiers={[monospacedDigit()]}>{props.deliveryCount}</Text>
      </HStack>
    ),
    minimal: <Image systemName="shippingbox.fill" />,
    expandedCenter: (
      <VStack spacing={0}>
        <Spacer minLength={0} />
        <Text modifiers={[font({ textStyle: 'caption' })]}>{freshnessLabel}</Text>
        <Spacer minLength={0} />
      </VStack>
    ),
    expandedLeading: (
      <VStack spacing={0}>
        <Spacer minLength={0} />
        <HStack>
          <Image systemName="shippingbox.fill" />
          <VStack spacing={0}>
            <Text modifiers={[font({ textStyle: 'caption' })]}>Baldes</Text>
            <Text modifiers={[font({ weight: 'semibold', size: 20 }), monospacedDigit()]}>
              {props.bucketCount}
            </Text>
          </VStack>
        </HStack>
        <Spacer minLength={0} />
      </VStack>
    ),
    expandedTrailing: (
      <VStack spacing={0}>
        <Spacer minLength={0} />
        <HStack>
          <VStack spacing={0}>
            <Text modifiers={[font({ textStyle: 'caption' })]}>Entregas</Text>
            <Text modifiers={[font({ weight: 'semibold', size: 20 }), monospacedDigit()]}>
              {props.deliveryCount}
            </Text>
          </VStack>
          <Image systemName="checklist" />
        </HStack>
        <Spacer minLength={0} />
      </VStack>
    ),
  };
}

export const wholesaleDeliveryLiveActivity = createLiveActivity(
  'WholesaleDeliveryLiveActivity',
  WholesaleDeliveryLiveActivity,
);
