import { router, Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function LabLayout() {
  const { resolvedMode } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        animation: 'default',
        headerShown: true,
        headerShadowVisible: false,
        headerTransparent: true,
        unstable_nativeProps: {
          headerConfig: {
            experimental_userInterfaceStyle: resolvedMode,
          },
        },
      }}
    >
      <Stack.Screen
        name="teste-morph"
        options={{ gestureEnabled: false, headerTitle: 'Teste Morph' }}
      >
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Configurações"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button accessibilityLabel="Ações do Teste Morph" icon="ellipsis" />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="teste-1" options={{ headerTitle: 'Teste 1' }}>
        <Stack.Screen.BackButton displayMode="default">Voltar</Stack.Screen.BackButton>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button accessibilityLabel="Ação principal do Teste 1" icon="plus" />
          <Stack.Toolbar.Button
            accessibilityLabel="Fechar Teste 1"
            icon="xmark"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
