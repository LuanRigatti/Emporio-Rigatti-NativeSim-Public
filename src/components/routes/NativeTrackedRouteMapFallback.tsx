import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { NativeTrackedRouteMapProps } from './NativeTrackedRouteMap.types';

export function NativeTrackedRouteMapFallback({ style }: NativeTrackedRouteMapProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        {
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          justifyContent: 'center',
          padding: theme.spacing.md,
        },
        style,
      ]}
    >
      <Text
        style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}
      >
        O mapa nativo está disponível na Development Build do iOS.
      </Text>
    </View>
  );
}
