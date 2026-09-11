import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Platform, Text, View } from 'react-native';

import {
  Badge,
  EmptyState,
  ErrorState,
  LargeTitleHeader,
  PrimaryButton,
  ScrollScreen,
  SecondaryButton,
  Section,
} from '@/components';
import { useNotifications } from '@/providers';
import type { MoreStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreNotifications'>;

function permissionLabel(permission: string | undefined): string {
  if (permission === 'granted') return 'Permitidas';
  if (permission === 'provisional') return 'Permitidas de forma provisória';
  if (permission === 'denied') return 'Bloqueadas';
  if (permission === 'undetermined') return 'Ainda não configuradas';
  if (permission === 'unsupported') return 'Indisponíveis nesta plataforma';
  return 'Verificando';
}

export function NotificationSettingsScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const notifications = useNotifications();
  const status = notifications.status;
  const unsupported = status?.permission === 'unsupported';
  const denied = status?.permission === 'denied';

  return (
    <ScrollScreen onRefresh={() => void notifications.refresh()} refreshing={notifications.loading}>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Notificações" />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        {notifications.error ? (
          <ErrorState
            description={notifications.error}
            onRetry={() => {
              notifications.clearError();
              void notifications.refresh();
            }}
            title="Não foi possível atualizar as notificações"
          />
        ) : null}
        {unsupported ? (
          <EmptyState
            description="O Expo Notifications nativo funciona em iOS e Android. O Web mantém o canal legado do navegador."
            icon={
              <Ionicons
                color={theme.colors.info}
                name="information-circle-outline"
                size={theme.sizes.iconLarge}
              />
            }
            title="Push nativo indisponível no Web"
          />
        ) : null}
        <Section title="Estado">
          <View style={{ gap: theme.spacing.sm }}>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                Permissão
              </Text>
              <Badge
                label={permissionLabel(status?.permission)}
                tone={denied ? 'danger' : 'success'}
              />
            </View>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                Token registrado
              </Text>
              <Badge
                label={status?.tokenRegistered ? 'Sim' : 'Não'}
                tone={status?.tokenRegistered ? 'success' : 'neutral'}
              />
            </View>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              O token nunca é exibido. Ele é usado somente pelo serviço de notificações.
            </Text>
          </View>
        </Section>
        {!unsupported ? (
          <Section title="Ações">
            <PrimaryButton
              fullWidth
              loading={notifications.loading}
              onPress={() => void notifications.requestPermission()}
            >
              {denied ? 'Tentar ativar novamente' : 'Ativar notificações'}
            </PrimaryButton>
            {denied ? (
              <SecondaryButton fullWidth onPress={() => void notifications.openSystemSettings()}>
                Abrir ajustes do sistema
              </SecondaryButton>
            ) : null}
          </Section>
        ) : null}
        <Section title="Tipos migrados">
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            • Nova entrega
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            • Lembretes de cobrança
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textTertiary }]}>
            Plataforma atual: {Platform.OS}
          </Text>
        </Section>
      </View>
    </ScrollScreen>
  );
}
