import type { ReactNode } from 'react';
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
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
};

export function PremiumScreen({
  children,
  scrollable = true,
  contentContainerStyle,
  scrollViewProps,
  style,
  ...props
}: PremiumScreenProps) {
  const { theme } = useAppTheme();
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
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]}
    >
      {scrollable ? (
        <ScrollView
          {...scrollViewProps}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
});
