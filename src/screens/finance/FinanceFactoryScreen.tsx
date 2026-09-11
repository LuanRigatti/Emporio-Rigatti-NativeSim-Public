import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  FinanceCard,
  LargeTitleHeader,
  ListItem,
  PrimaryButton,
  ScrollScreen,
  Section,
  SegmentedControl,
  Skeleton,
  StatusChip,
} from '@/components';
import { useFactoryReceipts } from '@/hooks/useFactoryReceipts';
import { useFinancialPrivacy } from '@/hooks/useFinancialPrivacy';
import type { FinanceStackParamList } from '@/navigation/types';
import type { FactoryPeriod } from '@/types/data';
import { formatCurrency } from '@/utils/data';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<FinanceStackParamList, 'FinanceFactory'>;

export function FinanceFactoryScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const { hidden } = useFinancialPrivacy();
  const [period, setPeriod] = useState<FactoryPeriod>('month');
  const filters = useMemo(() => ({ period }), [period]);
  const data = useFactoryReceipts(filters);

  return (
    <ScrollScreen onRefresh={() => void data.reload()} refreshing={data.refreshing}>
      <LargeTitleHeader
        onBack={() => navigation.goBack()}
        subtitle="Recebimentos, parcelas e saldo"
        title="Fábrica"
      />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        <SegmentedControl
          options={[
            { value: 'month' as const, label: 'Mês atual' },
            { value: 'all' as const, label: 'Todo o período' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <PrimaryButton
          fullWidth
          icon={
            <Ionicons color={theme.colors.textInverse} name="add" size={theme.sizes.iconMedium} />
          }
          onPress={() => navigation.navigate('FinanceFactoryForm')}
        >
          Novo recebimento
        </PrimaryButton>
        {data.loading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
            <Skeleton height={theme.sizes.loadingLineHeight * 4} />
          </View>
        ) : data.error ? (
          <ErrorState
            description={data.error}
            onRetry={() => void data.reload()}
            title="Não foi possível carregar a fábrica"
          />
        ) : data.summary ? (
          <>
            <Section title="Resumo">
              <FinanceCard
                hidden={hidden}
                label="Total pago"
                value={formatCurrency(data.summary.totalPaid)}
              />
              <FinanceCard
                hidden={hidden}
                label="Valor em aberto"
                value={formatCurrency(data.summary.openValue)}
              />
              <FinanceCard label="Total de baldes" value={`${data.summary.totalBuckets}`} />
            </Section>
            <Section title="Histórico de recebimentos">
              {data.receipts.length ? (
                data.receipts.map((receipt) => (
                  <ListItem
                    key={receipt.id}
                    onPress={() =>
                      navigation.navigate('FinanceFactoryDetails', { receiptId: receipt.id })
                    }
                    subtitle={`${receipt.quantidade} balde(s) · ${hidden ? '••••' : formatCurrency(receipt.valorTotal)}`}
                    title={receipt.data}
                    trailing={
                      <StatusChip
                        label={receipt.concluido ? 'Concluído' : 'Em aberto'}
                        status={receipt.concluido ? 'Pago' : 'Pendente'}
                      />
                    }
                  />
                ))
              ) : (
                <EmptyState
                  description="Os recebimentos da fábrica aparecerão aqui."
                  title="Nenhum recebimento"
                />
              )}
            </Section>
          </>
        ) : (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Nenhum dado disponível.
          </Text>
        )}
      </View>
    </ScrollScreen>
  );
}
