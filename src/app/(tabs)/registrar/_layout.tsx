import { Stack } from 'expo-router';

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
          hidesBottomBarWhenPushed: true,
          headerConfig: {
            experimental_userInterfaceStyle: resolvedMode,
          },
        },
      }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false, headerShown: true }} />
      <Stack.Screen name="entrega">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="dados">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
    </Stack>
  );
}
