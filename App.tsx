import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationRoot } from '@/navigation';
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
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
