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
  const financeToolbarRenderer = useActiveTabStore((s) => s.financeToolbarRenderer);
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const router = useRouter();

  if (activeTab === 'dashboard') {
    const accountName = user?.displayName?.trim() || 'Conta';
    return (
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
              router.push('/dashboard/pesquisa');
            }
          }}
        />
      </Stack.Toolbar.View>
    );
  }

  if (activeTab === 'financeiro' && financeToolbarRenderer) {
    return <>{financeToolbarRenderer()}</>;
  }

  return null;
}
