import type { StyleProp, ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

import { Shimmer } from './Shimmer';

export type PremiumSkeletonProps = {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  radius?: keyof ReturnType<typeof useAppTheme>['theme']['radius'];
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
};

export function Skeleton({
  animated = true,
  height,
  radius = 'sm',
  style,
  width = '100%',
}: PremiumSkeletonProps) {
  const { theme } = useAppTheme();

  return (
    <Shimmer
      animated={animated}
      style={[
        {
          borderRadius: theme.radius[radius],
          height: height ?? theme.sizes.loadingLineHeight,
          width,
        },
        style,
      ]}
    />
  );
}
