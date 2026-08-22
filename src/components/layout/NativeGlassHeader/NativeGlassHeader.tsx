import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import {
  logStartupDiagnostics,
  startupLayoutHandler,
  useStartupDiagnostics,
} from '@/utils/startupLayoutDiagnostics';

import NativeGlassHeaderBackground from './NativeGlassHeaderBackground';
import type { NativeGlassHeaderProps } from './NativeGlassHeader.types';

export function NativeGlassHeader({
  accessory,
  includeTopSafeArea = true,
  largeTitle = false,
  leftActions,
  mode = 'translucent',
  onLayout,
  pointerEvents,
  rightActions,
  search,
  segmentedControl,
  style,
  subtitle,
  title,
  titleStyle: customTitleStyle,
}: NativeGlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const resolvedTitleStyle = largeTitle ? theme.typography.largeTitle : theme.typography.headline;
  const diagnosticsComponent = `NativeGlassHeader.${title || 'untitled'}`;

  useStartupDiagnostics(diagnosticsComponent, {
    hasLeftActions: Boolean(leftActions),
    hasRightActions: Boolean(rightActions),
    includeTopSafeArea,
    insetsTop: insets.top,
    largeTitle,
    mode,
    paddingTop: includeTopSafeArea ? insets.top : 0,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    logStartupDiagnostics(diagnosticsComponent, 'layout', {
      frame: event.nativeEvent.layout,
    });
  };

  return (
    <View
      onLayout={handleLayout}
      pointerEvents={pointerEvents}
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
      <View
        onLayout={startupLayoutHandler(`${diagnosticsComponent}.topRow`)}
        style={[styles.topRow, { minHeight: theme.sizes.touchTargetMinimum }]}
      >
        <View
          onLayout={startupLayoutHandler(`${diagnosticsComponent}.leftActions`)}
          style={[
            styles.actions,
            { minWidth: largeTitle && !leftActions ? 0 : theme.sizes.touchTargetMinimum },
          ]}
        >
          {leftActions}
        </View>
        <View
          onLayout={startupLayoutHandler(`${diagnosticsComponent}.titleContainer`)}
          style={[styles.titleContainer, largeTitle ? styles.largeTitleContainer : undefined]}
        >
          <Text
            numberOfLines={1}
            onLayout={startupLayoutHandler(`${diagnosticsComponent}.title`)}
            style={[
              resolvedTitleStyle,
              customTitleStyle,
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
          onLayout={startupLayoutHandler(`${diagnosticsComponent}.rightActions`)}
          style={[
            styles.actions,
            styles.trailingActions,
            { minWidth: largeTitle && !rightActions ? 0 : theme.sizes.touchTargetMinimum },
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
  largeTitleContainer: {
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  largeTitle: {
    alignSelf: 'flex-start',
  },
});
