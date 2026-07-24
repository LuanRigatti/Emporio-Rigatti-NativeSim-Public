import { ActivityIndicator, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, spacing } from '@/theme';

export type LoadingProps = ViewProps & {
  size?: 'small' | 'large';
};

export function Loading({ size = 'large', style, ...props }: LoadingProps) {
  return (
    <View accessibilityLabel="Carregando" style={[styles.container, style]} {...props}>
      <ActivityIndicator color={colors.brand.primary} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
