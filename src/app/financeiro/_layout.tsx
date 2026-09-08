import { router, Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function FinanceLayout() {
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
      <Stack.Screen name="faturamento-mensal" options={{ gestureEnabled: true }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Finanças"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="lucro-liquido-mensal" options={{ gestureEnabled: true }}>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Voltar para Finanças"
            icon="chevron.left"
            onPress={() => router.back()}
          />
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
