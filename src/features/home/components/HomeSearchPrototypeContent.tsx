import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  query: string;
};

export default function HomeSearchPrototypeContent({ query }: Props) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>Resultados</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Resultados para “{query}”
      </Text>
      <Text style={[theme.typography.footnote, { color: theme.colors.textTertiary }]}>
        Busca inteligente
      </Text>
      {['Cliente', 'Entrega', 'Recebimento'].map((type) => (
        <View
          key={type}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.xl,
            },
          ]}
        >
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {type}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Prévia de resultado
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, padding: 16 },
  container: { gap: 16, padding: 20 },
});
