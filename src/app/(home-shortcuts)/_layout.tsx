import { router, Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function HomeShortcutsLayout() {
  const { resolvedMode } = useAppTheme();

  const screenOptions = {
    animation: 'default' as const,
    headerShown: true,
    headerShadowVisible: false,
    headerTitle: '',
    headerTransparent: true,
    unstable_nativeProps: {
      headerConfig: {
        experimental_userInterfaceStyle: resolvedMode,
      },
    },
  };

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="registrar-entrega" options={{ gestureEnabled: false }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Home"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="pesquisa" options={{ gestureEnabled: true }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Home"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="fabrica-compras" options={{ gestureEnabled: false }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Home"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="notas-fiscais-boletos" options={{ gestureEnabled: false }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Home"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
