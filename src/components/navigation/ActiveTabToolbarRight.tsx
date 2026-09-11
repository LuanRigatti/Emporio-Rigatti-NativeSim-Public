import { Stack, useRouter } from 'expo-router';
import { NativeHomeToolbarActions } from '@/components/native';
import { useActiveTabStore } from '@/navigation/activeTabStore';
import { useAuth } from '@/providers';
import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export function ActiveTabToolbarRight() {
  const activeTab = useActiveTabStore((s) => s.activeTab);
  const homeProfileHandler = useActiveTabStore((s) => s.homeProfileHandler);
  const homeSearchHandler = useActiveTabStore((s) => s.homeSearchHandler);
  const financeToolbar = useActiveTabStore((s) => s.financeToolbar);
  const historyToolbar = useActiveTabStore((s) => s.historyToolbar);
  const registrarToolbar = useActiveTabStore((s) => s.registrarToolbar);
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const router = useRouter();

  if (activeTab === 'dashboard') {
    const accountName = user?.displayName?.trim() || 'Conta';
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.View>
          <NativeHomeToolbarActions
            accessibilityHint="Exibe os dados da conta e a opção de sair"
            accessibilityLabel="Abrir perfil da conta"
            foregroundColor={theme.colors.textPrimary}
            imageUri={user?.photoUrl}
            name={accountName}
            onProfilePress={() => {
              if (homeProfileHandler) {
                homeProfileHandler();
              }
            }}
            onSearchPress={() => {
              if (homeSearchHandler) {
                homeSearchHandler();
              } else {
                triggerLightImpactHaptic();
                router.push('/pesquisa');
              }
            }}
          />
        </Stack.Toolbar.View>
      </Stack.Toolbar>
    );
  }

  if (activeTab === 'financeiro' && financeToolbar) {
    return <Stack.Toolbar placement="right">{financeToolbar}</Stack.Toolbar>;
  }

  if (activeTab === 'historico' && historyToolbar) {
    return <Stack.Toolbar placement="right">{historyToolbar}</Stack.Toolbar>;
  }

  if (activeTab === 'registrar' && registrarToolbar) {
    return <Stack.Toolbar placement="right">{registrarToolbar}</Stack.Toolbar>;
  }

  return null;
}
