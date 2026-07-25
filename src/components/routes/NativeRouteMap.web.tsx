import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';
import type { RouteCoordinate, RouteStop } from '@/types/route';

export type NativeRouteMapProps = {
  stops: readonly RouteStop[];
  polylines: readonly RouteCoordinate[][];
  selectable?: boolean;
  onSelectCoordinate?: (coordinate: RouteCoordinate) => void;
};

export function NativeRouteMap(props: NativeRouteMapProps) {
  const { theme } = useAppTheme();
  void props;
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        flex: 1,
        justifyContent: 'center',
      }}
    >
      <Text
        style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}
      >
        O mapa nativo será validado em um development build no dispositivo.
      </Text>
    </View>
  );
}
