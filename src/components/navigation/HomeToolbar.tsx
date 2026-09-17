import { useCallback, useState } from 'react';
import { Stack } from 'expo-router';

import { NativeHomeToolbarActions, NativeModeSheetContent, NativeSheet } from '@/components/native';
import { useAppMode } from '@/providers';
import type { AppMode } from '@/types/appMode';

type HomeToolbarProps = {
  foregroundColor: string;
  imageUri?: string | null;
  name: string;
  onProfilePress: () => void;
  onSearchPress: () => void;
};

export function HomeToolbar({
  foregroundColor,
  imageUri,
  name,
  onProfilePress,
  onSearchPress,
}: HomeToolbarProps) {
  const { mode, setMode } = useAppMode();
  const [modeSheetVisible, setModeSheetVisible] = useState(false);
  const openModeSheet = useCallback(() => setModeSheetVisible(true), []);
  const handleModeSelection = useCallback(
    (nextMode: AppMode) => {
      if (nextMode !== mode) setMode(nextMode);
      setModeSheetVisible(false);
    },
    [mode, setMode],
  );

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
            onSearchPress={onSearchPress}
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
