import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function FinanceLayout() {
  const { resolvedMode } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        animation: 'default',
        headerShadowVisible: false,
        headerShown: false,
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
    </Stack>
  );
}
