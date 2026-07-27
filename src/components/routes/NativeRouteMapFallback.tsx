import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { NativeRouteMapProps } from './NativeRouteMap.types';

export function NativeRouteMapFallback({ stops }: NativeRouteMapProps) {
  const { theme } = useAppTheme();
  const message =
    stops.length > 0
      ? 'O mapa nativo está disponível no Development Build.'
      : 'Nenhum ponto confirmado para exibir no mapa.';

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        flex: 1,
        justifyContent: 'center',
        padding: theme.spacing.md,
      }}
    >
      <Text
        style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}
      >
        {message}
      </Text>
    </View>
  );
}
