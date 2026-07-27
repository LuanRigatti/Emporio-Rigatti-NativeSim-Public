import { StyleSheet, Text, View } from 'react-native';

import { GlassButton } from '@/components/premium';
import { useAppTheme } from '@/theme';

import HistorySymbolIcon from './HistorySymbolIcon';

export type EmptyStateProps = {
  onBackToToday: () => void;
};

export function EmptyState({ onBackToToday }: EmptyStateProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.illustration,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.pill,
            height: 92,
            width: 92,
          },
        ]}
      >
        <HistorySymbolIcon
          color={theme.colors.textTertiary}
          fallbackIcon="file-tray-outline"
          size={theme.sizes.iconLarge}
          systemName="tray"
        />
      </View>
      <Text style={[theme.typography.headline, styles.title, { color: theme.colors.textPrimary }]}>
        Nenhuma entrega encontrada
      </Text>
      <Text
        style={[
          theme.typography.footnote,
          styles.description,
          { color: theme.colors.textSecondary },
        ]}
      >
        Não há entregas registradas para esta data.
      </Text>
      <GlassButton
        accessibilityHint="Seleciona o dia atual no calendário"
        icon="today-outline"
        label="Voltar para hoje"
        onPress={onBackToToday}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, paddingBottom: 24 },
  illustration: { alignItems: 'center', justifyContent: 'center' },
  title: { maxWidth: 280, textAlign: 'center' },
  description: { maxWidth: 280, textAlign: 'center' },
});
