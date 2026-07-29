import { StyleSheet, Text, View } from 'react-native';

import { NativeButton } from '@/components/native';
import { useAppTheme } from '@/theme';

export type EmptyStateProps = {
  onBackToToday: () => void;
};

export function EmptyState({ onBackToToday }: EmptyStateProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}>
        Nenhuma entrega encontrada
      </Text>
      <NativeButton
        accessibilityHint="Seleciona o dia atual no calendário"
        accessibilityLabel="Voltar para hoje"
        fallbackIcon="today-outline"
        haptic="light"
        label="Voltar"
        onPress={onBackToToday}
        systemImage="calendar"
        variant="glass"
      />
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
