import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

import NativeGlassHeaderBackground from './NativeGlassHeaderBackground';
import type { NativeGlassHeaderProps } from './NativeGlassHeader.types';

export function NativeGlassHeader({
  accessory,
  includeTopSafeArea = true,
  largeTitle = false,
  leftActions,
  mode = 'translucent',
  onLayout,
  rightActions,
  search,
  segmentedControl,
  style,
  subtitle,
  title,
}: NativeGlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const titleStyle = largeTitle ? theme.typography.largeTitle : theme.typography.headline;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        {
          paddingHorizontal: theme.layout.screenHorizontalPadding,
          paddingTop: includeTopSafeArea ? insets.top : 0,
        },
        mode === 'floating' ? styles.floating : undefined,
        style,
      ]}
    >
      <NativeGlassHeaderBackground mode={mode} />
      <View style={[styles.topRow, { minHeight: theme.sizes.touchTargetMinimum }]}>
        <View style={[styles.actions, { minWidth: theme.sizes.touchTargetMinimum }]}>
          {leftActions}
        </View>
        <View style={styles.titleContainer}>
          <Text
            numberOfLines={1}
            style={[
              titleStyle,
              { color: theme.colors.textPrimary },
              largeTitle && styles.largeTitle,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.actions,
            styles.trailingActions,
            { minWidth: theme.sizes.touchTargetMinimum },
          ]}
        >
          {rightActions}
        </View>
      </View>
      {search}
      {segmentedControl}
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  floating: {
    zIndex: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  trailingActions: {
    justifyContent: 'flex-end',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  largeTitle: {
    alignSelf: 'flex-start',
  },
});
