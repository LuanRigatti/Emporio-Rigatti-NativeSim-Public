import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useAppTheme } from '@/theme';

export type LargeTitleProps = {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export function LargeTitle({
  accessibilityLabel,
  style,
  subtitle,
  title,
  trailing,
}: LargeTitleProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text
          accessibilityLabel={accessibilityLabel ?? title}
          allowFontScaling
          style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }, style]}
        >
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? (
        <Text
          allowFontScaling
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
