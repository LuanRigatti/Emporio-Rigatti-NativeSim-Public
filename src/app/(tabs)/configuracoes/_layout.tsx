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
          hidesBottomBarWhenPushed: true,
          headerConfig: {
            experimental_userInterfaceStyle: resolvedMode,
          },
        },
      }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false, headerShown: true }} />
    </Stack>
  );
}
