import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function DashboardLayout() {
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
      <Stack.Screen name="registrar-entrega" options={{ gestureEnabled: true }}>
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="em-aberto" options={{ gestureEnabled: true }}>
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="notas-fiscais-boletos" options={{ gestureEnabled: true }}>
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="fabrica-compras" options={{ gestureEnabled: true }}>
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
    </Stack>
  );
}
