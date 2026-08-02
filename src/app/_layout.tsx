import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, SessionProvider } from '@/providers';
import { ThemeProvider } from '@/theme';

export default function PrototypeRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <AuthProvider>
            <ThemeProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ gestureEnabled: false }} />
                <Stack.Screen name="login" options={{ gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
              </Stack>
            </ThemeProvider>
          </AuthProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
