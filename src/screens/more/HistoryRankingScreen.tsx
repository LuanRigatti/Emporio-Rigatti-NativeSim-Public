import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  ListItem,
  ProgressBar,
  ScrollScreen,
  Section,
  Skeleton,
} from '@/components';
import { useHistory } from '@/hooks/useHistory';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { MoreStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';
import { formatCurrency } from '@/utils/data';

type Props = NativeStackScreenProps<MoreStackParamList, 'HistoryRanking'>;

export function HistoryRankingScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const history = useHistory(route.params ?? { period: 'month' });

  return (
    <ScrollScreen onRefresh={() => void history.reload()} refreshing={history.refreshing}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Ranking do histórico" />
      <View style={{ padding: theme.spacing.md }}>
        {history.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 3} />
            <Skeleton height={theme.sizes.loadingLineHeight * 3} />
          </View>
        ) : history.error ? (
          <ErrorState
            description={history.error}
            onRetry={() => void history.reload()}
            title="Não foi possível carregar o ranking"
          />
        ) : history.ranking.length === 0 ? (
          <EmptyState description="Não existem entregas no recorte atual." title="Ranking vazio" />
        ) : (
          <Section title="Clientes">
            {history.ranking.map((item, index) => (
              <ListItem
                key={item.nome}
                subtitle={`${item.entregas} entrega(s) · ${item.quantidade} balde(s)`}
                title={`${index + 1}. ${item.nome}`}
                trailing={
                  <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
                    {hidden ? '••••' : formatCurrency(item.valor)}
                  </Text>
                }
              />
            ))}
            <ProgressBar
              label="Participação do primeiro cliente"
              progress={(history.ranking[0]?.percentual ?? 0) / 100}
              tone="info"
            />
          </Section>
        )}
      </View>
    </ScrollScreen>
  );
}
