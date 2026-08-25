import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function SettingsLayout() {
  const { resolvedMode } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        animation: 'default',
        headerShadowVisible: false,
        headerShown: true,
        headerTitle: '',
        headerTransparent: true,
        unstable_nativeProps: {
          headerConfig: {
            experimental_userInterfaceStyle: resolvedMode,
          },
        },
      }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="clientes">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="clientes/[clientId]" options={{ headerBackButtonMenuEnabled: false }}>
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="dados-empresa">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="fabrica">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="fabrica/valor-balde">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="fabrica/compras-menu">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="fabrica/compras">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="fabrica/compras/registrar">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="dados">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="dados/mensais">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="dados/diarios">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="dados/carro">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="face-id">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="sistema">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="modo-teste">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="backup">
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
      </Stack.Screen>
      <Stack.Screen name="estoque">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
    </Stack>
  );
}
