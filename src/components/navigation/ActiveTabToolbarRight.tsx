import { useCallback, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { NativeHomeToolbarActions, NativeModeSheetContent, NativeSheet } from '@/components/native';
import { useActiveTabStore } from '@/navigation/activeTabStore';
import { useAppMode, useAuth } from '@/providers';
import { useAppTheme } from '@/theme';
import type { AppMode } from '@/types/appMode';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export function ActiveTabToolbarRight() {
  const activeTab = useActiveTabStore((s) => s.activeTab);
  const homeProfileHandler = useActiveTabStore((s) => s.homeProfileHandler);
  const homeSearchHandler = useActiveTabStore((s) => s.homeSearchHandler);
  const financeToolbar = useActiveTabStore((s) => s.financeToolbar);
  const historyToolbar = useActiveTabStore((s) => s.historyToolbar);
  const registrarToolbar = useActiveTabStore((s) => s.registrarToolbar);
  const { mode, setMode } = useAppMode();
  const [modeSheetVisible, setModeSheetVisible] = useState(false);
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const router = useRouter();
  const openModeSheet = useCallback(() => setModeSheetVisible(true), []);
  const handleModeSelection = useCallback(
    (nextMode: AppMode) => {
      if (nextMode !== mode) setMode(nextMode);
      setModeSheetVisible(false);
    },
    [mode, setMode],
  );

  if (activeTab === 'dashboard') {
    const accountName = user?.displayName?.trim() || 'Conta';
    return (
      <>
        <Stack.Toolbar placement="left">
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
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Selecionar modo comercial"
            onPress={openModeSheet}
            separateBackground={false}
          >
            Modo
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <NativeSheet
          accessibilityLabel="Modo de venda"
          onVisibleChange={setModeSheetVisible}
          visible={modeSheetVisible}
        >
          <NativeModeSheetContent mode={mode} onSelect={handleModeSelection} />
        </NativeSheet>
      </>
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
