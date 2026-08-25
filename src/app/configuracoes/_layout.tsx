import { router, Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function SettingsLocationLayout() {
  const { resolvedMode } = useAppTheme();

  const screenOptions = {
    animation: 'default' as const,
    headerShadowVisible: false,
    headerShown: true,
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
      <Stack.Screen name="localizacao" options={{ gestureEnabled: false }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Configurações"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="localizacao/[routeId]">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
    </Stack>
  );
}
