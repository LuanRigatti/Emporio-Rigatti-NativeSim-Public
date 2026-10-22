import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  minimumScaleFactor,
  opacity,
  padding,
  resizable,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { RouteTrackingLiveActivityContent } from './RouteTrackingLiveActivityContracts';

function RouteTrackingLiveActivity(
  props: RouteTrackingLiveActivityContent,
  environment: LiveActivityEnvironment,
) {
  'widget';

  const maxActiveActivityDurationMs = 8 * 60 * 60 * 1000;

  function formatRouteTrackingKilometers(distanceMeters: number): string {
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return '—';

    const tenthsOfKilometer = Math.round(distanceMeters / 100);
    const integerPart = Math.floor(tenthsOfKilometer / 10).toString();
    const decimalPart = tenthsOfKilometer % 10;
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${groupedInteger},${decimalPart}`;
  }

  function getRouteTrackingTimerInterval(startTimestamp: number, endTimestamp?: number) {
    if (!Number.isFinite(startTimestamp) || startTimestamp <= 0) return null;
    if (
      endTimestamp !== undefined &&
      (!Number.isFinite(endTimestamp) || endTimestamp < startTimestamp)
    ) {
      return null;
    }

    const lower = new Date(startTimestamp);
    if (endTimestamp !== undefined) {
      const upper = new Date(endTimestamp);
      return { lower, pauseTime: upper, upper };
    }

    return {
      lower,
      upper: new Date(startTimestamp + maxActiveActivityDurationMs),
    };
  }

  const sharedImageDirectory = (
    environment as LiveActivityEnvironment & { widgetsDirectory?: string | null }
  ).widgetsDirectory;
  const brandMarkURI =
    typeof sharedImageDirectory === 'string' && sharedImageDirectory.startsWith('file://')
      ? `${sharedImageDirectory.endsWith('/') ? sharedImageDirectory : `${sharedImageDirectory}/`}resumo-financeiro-mark-dark.png`
      : undefined;
  const distanceLabel = formatRouteTrackingKilometers(props.distanceMeters);
  const timerInterval = getRouteTrackingTimerInterval(props.startTimestamp, props.endTimestamp);
  const primaryColor = environment.isLuminanceReduced ? '#B8B8BD' : '#FFFFFF';
  const statusColor = environment.isLuminanceReduced ? '#6E6E73' : '#8E8E93';

  const brandMark = (size: number) => (
    <Image
      uiImage={brandMarkURI}
      modifiers={[
        resizable(),
        frame({ width: size, height: size }),
        opacity(environment.isLuminanceReduced ? 0.72 : 1),
      ]}
    />
  );

  const navigationIcon = (size: number) => (
    <Image systemName="location.north.fill" color={primaryColor} size={size} />
  );

  return {
    banner: (
      <VStack spacing={12} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={10}>
          {brandMark(32)}
          <VStack spacing={2}>
            <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle(primaryColor)]}>
              Rastreamento ativo
            </Text>
          </VStack>
          <Spacer minLength={0} />
          {navigationIcon(18)}
        </HStack>
        <HStack spacing={16}>
          <VStack spacing={2} modifiers={[frame({ maxWidth: Infinity })]}>
            <Text
              modifiers={[
                font({ weight: 'bold', size: 32 }),
                foregroundStyle(primaryColor),
                monospacedDigit(),
                lineLimit(1),
                minimumScaleFactor(0.75),
              ]}
            >
              {distanceLabel}
            </Text>
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(statusColor)]}>
              Km percorridos
            </Text>
          </VStack>
          <VStack spacing={2} modifiers={[frame({ maxWidth: Infinity })]}>
            {timerInterval ? (
              <Text
                timerInterval={{ lower: timerInterval.lower, upper: timerInterval.upper }}
                countsDown={false}
                pauseTime={timerInterval.pauseTime}
                modifiers={[
                  font({ weight: 'bold', size: 32 }),
                  foregroundStyle(primaryColor),
                  monospacedDigit(),
                  lineLimit(1),
                  minimumScaleFactor(0.75),
                ]}
              />
            ) : (
              <Text modifiers={[font({ weight: 'bold', size: 32 }), foregroundStyle(primaryColor)]}>
                —
              </Text>
            )}
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(statusColor)]}>
              Tempo em rota
            </Text>
          </VStack>
        </HStack>
      </VStack>
    ),
    compactLeading: navigationIcon(18),
    compactTrailing: brandMark(24),
    minimal: navigationIcon(16),
    expandedLeading: brandMark(34),
    expandedTrailing: navigationIcon(18),
    expandedCenter: (
      <Text
        modifiers={[
          font({ textStyle: 'caption' }),
          foregroundStyle(statusColor),
          frame({ maxWidth: Infinity, alignment: 'center' }),
        ]}
      >
        Rastreamento ativo
      </Text>
    ),
    expandedBottom: (
      <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 8 })]}>
        <VStack spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 30 }),
              foregroundStyle(primaryColor),
              monospacedDigit(),
              lineLimit(1),
              minimumScaleFactor(0.72),
            ]}
          >
            {distanceLabel}
          </Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(statusColor)]}>Km percorridos</Text>
        </VStack>
        <VStack spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
          {timerInterval ? (
            <Text
              timerInterval={{ lower: timerInterval.lower, upper: timerInterval.upper }}
              countsDown={false}
              pauseTime={timerInterval.pauseTime}
              modifiers={[
                font({ weight: 'bold', size: 30 }),
                foregroundStyle(primaryColor),
                monospacedDigit(),
                lineLimit(1),
                minimumScaleFactor(0.72),
              ]}
            />
          ) : (
            <Text modifiers={[font({ weight: 'bold', size: 30 }), foregroundStyle(primaryColor)]}>
              —
            </Text>
          )}
          <Text modifiers={[font({ size: 12 }), foregroundStyle(statusColor)]}>Tempo em rota</Text>
        </VStack>
      </HStack>
    ),
  };
}

export const routeTrackingLiveActivity = createLiveActivity(
  'RouteTrackingLiveActivity',
  RouteTrackingLiveActivity,
);
