import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  ConfirmationDialog,
  Input,
  LargeTitleHeader,
  PrimaryButton,
  ScrollScreen,
  Section,
} from '@/components';
import { useClients } from '@/hooks/useClients';
import { calculateClientImpact } from '@/services/clients';
import type { ClientsStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<ClientsStackParamList, 'ClientRenameReview'>;

export function ClientRenameReview({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const { snapshot, clients, rename } = useClients();
  const client = clients.find((item) => item.clientId === route.params.clientId);
  const impact = snapshot && client ? calculateClientImpact(snapshot, client) : undefined;
  const [newName, setNewName] = useState(route.params.clientName);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const impactText = useMemo(() => {
    if (!impact) return 'Carregando impacto...';
    return `${impact.deliveryCount} entregas, ${impact.relatedPaymentCount} pagamentos relacionados e ${impact.relatedHistoryCount} registros históricos serão atualizados.`;
  }, [impact]);

  const handleConfirm = async () => {
    if (!client) return;
    setSaving(true);
    setError(undefined);
    try {
      await rename(client, newName);
      navigation.popTo('ClientDetails', { clientId: client.clientId, clientName: newName });
    } catch (renameError) {
      setError(
        renameError instanceof Error ? renameError.message : 'Não foi possível renomear o cliente.',
      );
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <ScrollScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Renomear cliente" />
      <View style={{ padding: theme.spacing.lg }}>
        <Input
          error={error}
          helperText="Aliases existentes não podem ser utilizados."
          label="Novo nome"
          onChangeText={setNewName}
          required
          value={newName}
        />
        <Section title="Impacto da operação">
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {impactText}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Será gerado um backup preventivo. Nenhum valor ou histórico será apagado.
          </Text>
        </Section>
        <PrimaryButton fullWidth onPress={() => setConfirming(true)}>
          Revisar e confirmar
        </PrimaryButton>
      </View>
      <ConfirmationDialog
        confirmLabel="Renomear e atualizar referências"
        destructive={false}
        loading={saving}
        message={`${impactText} A operação atualizará o nome nas entregas e na configuração personalizada.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void handleConfirm()}
        title="Confirmar renomeação"
        visible={confirming}
      />
    </ScrollScreen>
  );
}
