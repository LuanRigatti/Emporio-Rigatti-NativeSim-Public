import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashGate } from '@/features/splash';
import { AuthProvider, SessionProvider } from '@/providers';
import { ThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function AppShell() {
  return (
    <SplashGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      </Stack>
    </SplashGate>
  );
}

export default function PrototypeRootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <AuthProvider>
            <ThemeProvider>
              <AppShell />
            </ThemeProvider>
          </AuthProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
