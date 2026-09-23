import { useCallback, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';

import { NativeHomeToolbarActions, NativeModeSheetContent, NativeSheet } from '@/components/native';
import { useAppMode } from '@/providers';
import { registrarDeliveryDarkLiquidGlassTint, useAppTheme } from '@/theme';
import type { AppMode } from '@/types/appMode';
import { triggerLightImpactHaptic } from '@/utils/haptics';

export type HomeModeSelectorController = {
  mode: AppMode;
  visible: boolean;
  open: () => void;
  onVisibleChange: (visible: boolean) => void;
  onDismiss: () => void;
  onSelect: (mode: AppMode) => void;
};

export function useHomeModeSelector(): HomeModeSelectorController {
  const { mode, setMode } = useAppMode();
  const [modeSheetVisible, setModeSheetVisible] = useState(false);
  const pendingModeRef = useRef<AppMode | null>(null);
  const open = useCallback(() => {
    pendingModeRef.current = null;
    triggerLightImpactHaptic();
    setModeSheetVisible(true);
  }, []);
  const onSelect = useCallback(
    (nextMode: AppMode) => {
      pendingModeRef.current = nextMode === mode ? null : nextMode;
      setModeSheetVisible(false);
    },
    [mode],
  );
  const onDismiss = useCallback(() => {
    const nextMode = pendingModeRef.current;
    pendingModeRef.current = null;

    if (nextMode && nextMode !== mode) setMode(nextMode);
  }, [mode, setMode]);

  return useMemo(
    () => ({
      mode,
      visible: modeSheetVisible,
      open,
      onVisibleChange: setModeSheetVisible,
      onDismiss,
      onSelect,
    }),
    [mode, modeSheetVisible, onDismiss, onSelect, open],
  );
}

type HomeToolbarProps = {
  foregroundColor: string;
  imageUri?: string | null;
  name: string;
  onProfilePress: () => void;
  onSearchPress?: () => void;
  showSearch?: boolean;
  modeSelector: HomeModeSelectorController;
};

export function HomeToolbar({
  foregroundColor,
  imageUri,
  name,
  onProfilePress,
  onSearchPress,
  showSearch = false,
  modeSelector,
}: HomeToolbarProps) {
  const { mode } = modeSelector;
  const { resolvedMode } = useAppTheme();
  const useDarkGlassSurface = resolvedMode === 'dark';

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View>
          <NativeHomeToolbarActions
            accessibilityHint="Exibe os dados da conta e a opção de sair"
            accessibilityLabel="Abrir perfil da conta"
            foregroundColor={foregroundColor}
            imageUri={imageUri}
            name={name}
            onProfilePress={onProfilePress}
            showSearch={showSearch}
          />
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      {onSearchPress ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Abrir Pesquisa"
            onPress={onSearchPress}
            separateBackground={false}
          >
            <Stack.Toolbar.Icon sf="magnifyingglass" />
            <Stack.Toolbar.Label>PESQUISA</Stack.Toolbar.Label>
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <NativeSheet
        accessibilityLabel="Modo de venda"
        detents={[{ fraction: 0.25 }]}
        glassSurface={useDarkGlassSurface}
        glassTint={useDarkGlassSurface ? registrarDeliveryDarkLiquidGlassTint : undefined}
        onDismiss={modeSelector.onDismiss}
        onVisibleChange={modeSelector.onVisibleChange}
        visible={modeSelector.visible}
      >
        <NativeModeSheetContent mode={mode} onSelect={modeSelector.onSelect} />
      </NativeSheet>
    </>
  );
}
