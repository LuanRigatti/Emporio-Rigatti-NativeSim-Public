import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

export function EmptyState({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}>
        Nenhuma entrega encontrada
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    justifyContent: 'center',
    minHeight: 320,
  },
  title: { maxWidth: 280, textAlign: 'center' },
});
