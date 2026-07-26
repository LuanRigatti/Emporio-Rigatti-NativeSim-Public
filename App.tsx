import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationRoot } from '@/navigation';
import { AuthProvider, FinancialPrivacyProvider, NotificationProvider } from '@/providers';
import { ThemeProvider, useAppTheme } from '@/theme';

function AppContent() {
  const { resolvedMode } = useAppTheme();

  return (
    <>
      <NavigationRoot />
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  const [iconsLoaded, iconsError] = useFonts(Ionicons.font);

  if (!iconsLoaded && !iconsError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <FinancialPrivacyProvider>
              <NotificationProvider>
                <AppContent />
              </NotificationProvider>
            </FinancialPrivacyProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = {
  root: { flex: 1 },
} as const;
