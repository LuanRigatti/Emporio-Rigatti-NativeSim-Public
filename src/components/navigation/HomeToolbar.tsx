import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack } from 'expo-router';

import { NativeHomeToolbarActions, NativeModeSheetContent, NativeSheet } from '@/components/native';
import { useHomeModeTransition } from '@/features/home/hooks/useHomeModeTransition';
import { useAppMode } from '@/providers';
import { setExpectedHomeToolbarComposition } from '@/platform/nativeToolbarReadiness';
import { useAppTheme } from '@/theme';
import type { AppMode } from '@/types/appMode';
import { triggerLightImpactHaptic } from '@/utils/haptics';

const DARK_MODE_MODE_SELECTOR_GLASS_TINT = 'rgba(28, 28, 30, 0.82)' as const;
const LIGHT_MODE_MODE_SELECTOR_GLASS_TINT = 'rgba(242, 244, 245, 0.85)' as const;

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

  useEffect(() => {
    setExpectedHomeToolbarComposition(mode);
  }, [mode]);

  return (
    <>
      {onSearchPress ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.View>
            <NativeHomeToolbarActions
              mode="searchAction"
              name=""
              onSearchPress={onSearchPress}
              searchAccessibilityHint="Abre a busca de produtos"
              searchAccessibilityLabel="Busca"
            />
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
      <NativeSheet
        accessibilityLabel="Modo de venda"
        detents={[{ fraction: 0.25 }]}
        glassSurface
        glassTint={
          resolvedMode === 'dark'
            ? DARK_MODE_MODE_SELECTOR_GLASS_TINT
            : LIGHT_MODE_MODE_SELECTOR_GLASS_TINT
        }
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
