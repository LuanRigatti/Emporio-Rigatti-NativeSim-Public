import { useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export type PremiumScreenProps = ViewProps & {
  children: ReactNode;
  overlayBackground?: ReactNode;
  overlayHeader?: ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
};

export function PremiumScreen({
  children,
  overlayBackground,
  overlayHeader,
  scrollable = true,
  contentContainerStyle,
  scrollViewProps,
  style,
  ...props
}: PremiumScreenProps) {
  const { theme } = useAppTheme();
  const [overlayHeaderHeight, setOverlayHeaderHeight] = useState(0);
  const contentStyle = [
    styles.content,
    {
      paddingHorizontal: theme.layout.screenHorizontalPadding,
      paddingBottom: theme.spacing.xxxl,
    },
    contentContainerStyle,
  ];

  return (
    <SafeAreaView
      {...props}
      edges={overlayHeader ? [] : ['top']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]}
    >
      {scrollable ? (
        <ScrollView
          {...scrollViewProps}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            contentStyle,
            overlayHeader ? { paddingTop: overlayHeaderHeight } : undefined,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ overflow: 'visible' }}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[contentStyle, overlayHeader ? { paddingTop: overlayHeaderHeight } : undefined]}
        >
          {children}
        </View>
      )}
      {overlayBackground}
      {overlayHeader ? (
        <View
          onLayout={(event) => setOverlayHeaderHeight(event.nativeEvent.layout.height)}
          pointerEvents="box-none"
          style={styles.overlayHeader}
        >
          {overlayHeader}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
  overlayHeader: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 2 },
});
