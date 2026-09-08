import { router, Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function RegistrarLayout() {
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
      <Stack.Screen name="entrega" options={{ gestureEnabled: true }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Registrar"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="dados" options={{ gestureEnabled: true }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Registrar"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
