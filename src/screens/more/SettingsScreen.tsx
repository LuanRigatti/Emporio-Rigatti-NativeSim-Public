import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import {
  AppText,
  DestructiveButton,
  LargeTitleHeader,
  ListItem,
  ScrollScreen,
  Section,
  SegmentedControl,
  SwitchField,
} from '@/components';
import { useAuth, useFinancialPrivacyContext } from '@/providers';
import type { MoreStackParamList } from '@/navigation/types';
import { useAppTheme, type ThemeMode } from '@/theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreSettings'>;

const themeOptions: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export function SettingsScreen({ navigation }: Props) {
  const { theme, mode, setMode } = useAppTheme();
  const { user, isLoading, signOut } = useAuth();
  const { hidden, setHidden } = useFinancialPrivacyContext();

  return (
    <ScrollScreen>
      <LargeTitleHeader onBack={() => navigation.goBack()} title="Configurações" />
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.md }}>
        <Section title="Aparência">
          <AppText variant="footnote" style={{ color: theme.colors.textSecondary }}>
            A preferência é salva localmente e aplicada ao aplicativo inteiro.
          </AppText>
          <SegmentedControl options={themeOptions} value={mode} onChange={setMode} />
          <SwitchField
            helperText="Substitui valores monetários por marcadores sem alterar os dados ou cálculos."
            label="Ocultar valores financeiros"
            value={hidden}
            onValueChange={setHidden}
          />
        </Section>

        <Section title="Ferramentas">
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="notifications-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('MoreNotifications')}
            subtitle="Permissão, token e status do push"
            title="Notificações"
          />
          <ListItem
            leading={
              <Ionicons
                color={theme.colors.primary}
                name="archive-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => navigation.navigate('MoreBackup')}
            subtitle="Exportar ou importar os dados compatíveis"
            title="Backup"
          />
        </Section>

        <Section title="Conta">
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {user?.displayName ?? 'Conta autenticada'}
            </Text>
            <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
              {user?.email ?? 'E-mail não informado'}
            </Text>
          </View>
          <DestructiveButton
            accessibilityHint="Encerra a sessão neste dispositivo"
            fullWidth
            loading={isLoading}
            onPress={() => void signOut()}
          >
            Sair da conta
          </DestructiveButton>
        </Section>
      </View>
    </ScrollScreen>
  );
}
