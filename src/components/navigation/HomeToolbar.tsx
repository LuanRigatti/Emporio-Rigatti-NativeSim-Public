import { useCallback, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import {
  HOME_TOOLBAR_CONTROL_SIZE,
  NativeHomeToolbarActions,
  NativeModeSheetContent,
  NativeSheet,
} from '@/components/native';
import { useHomeModeTransition } from '@/features/home/hooks/useHomeModeTransition';
import { useAppMode } from '@/providers';
import { getLiquidGlassTint, useAppTheme } from '@/theme';
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
  const appMode = useAppMode();
  const { mode } = appMode;
  const { isTransitioning, requestModeTransition } = useHomeModeTransition(appMode);
  const [modeSheetVisible, setModeSheetVisible] = useState(false);
  const pendingModeRef = useRef<AppMode | null>(null);
  const open = useCallback(() => {
    if (isTransitioning) return;
    pendingModeRef.current = null;
    triggerLightImpactHaptic();
    setModeSheetVisible(true);
  }, [isTransitioning]);
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

    if (nextMode && nextMode !== mode) requestModeTransition(nextMode);
  }, [mode, requestModeTransition]);

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
  onSearchPress?: () => void;
  modeSelector: HomeModeSelectorController;
};

export function HomeToolbar({ onSearchPress, modeSelector }: HomeToolbarProps) {
  const { mode } = modeSelector;
  const { resolvedMode } = useAppTheme();

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <View
            accessible={false}
            collapsable={false}
            pointerEvents="none"
            style={{ height: HOME_TOOLBAR_CONTROL_SIZE, width: HOME_TOOLBAR_CONTROL_SIZE }}
            testID="home-toolbar-item:leading-anchor:44x44"
          />
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.View>
          {mode === 'wholesale' && onSearchPress ? (
            <NativeHomeToolbarActions
              accessibilityHint="Abre o seletor de modo Atacado ou Varejo."
              accessibilityLabel="Alterar modo. Modo atual: Atacado"
              mode="modeAndSearchActions"
              onModePress={modeSelector.open}
              onSearchPress={onSearchPress}
              searchAccessibilityHint="Abre a busca de produtos"
              searchAccessibilityLabel="Busca"
              toolbarMorphDiagnosticRole="home-search"
            />
          ) : (
            <NativeHomeToolbarActions
              accessibilityHint="Abre o seletor de modo Atacado ou Varejo."
              accessibilityLabel={`Alterar modo. Modo atual: ${mode === 'retail' ? 'Varejo' : 'Atacado'}`}
              mode="modeOnlyAction"
              onModePress={modeSelector.open}
              toolbarMorphDiagnosticRole="home-search"
            />
          )}
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <NativeSheet
        accessibilityLabel="Modo de venda"
        detents={[{ fraction: 0.4 }]}
        glassSurface
        glassTint={getLiquidGlassTint(resolvedMode)}
        onDismiss={modeSelector.onDismiss}
        onVisibleChange={modeSelector.onVisibleChange}
        presentationBackgroundInteraction="disabled"
        visible={modeSelector.visible}
      >
        <NativeModeSheetContent mode={mode} onSelect={modeSelector.onSelect} />
      </NativeSheet>
    </>
  );
}
