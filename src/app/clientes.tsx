import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { NativeGlassBackButton } from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

export default function ClientsRoute() {
  const { theme } = useAppTheme();
  const router = useRouter();

  return (
    <PremiumScreen contentContainerStyle={{ backgroundColor: theme.colors.background }}>
      <View>
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Configurações"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
      </View>
    </PremiumScreen>
  );
}
