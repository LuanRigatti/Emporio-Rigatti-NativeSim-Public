import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function FinanceDetailLayout() {
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
      <Stack.Screen name="faturamento-mensal">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
      <Stack.Screen name="lucro-liquido-mensal">
        <Stack.Screen.BackButton displayMode="minimal" />
      </Stack.Screen>
    </Stack>
  );
}
