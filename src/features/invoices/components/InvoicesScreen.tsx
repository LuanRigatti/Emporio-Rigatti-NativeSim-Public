import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassBackButton } from '@/components/native';
import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

export function InvoicesScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();

  return (
    <PremiumScreen contentContainerStyle={styles.screenContent}>
      <View style={styles.header}>
        <NativeGlassBackButton
          accessibilityLabel="Voltar para Home"
          color={theme.colors.textPrimary}
          containerSize={theme.sizes.touchTargetMinimum}
          onPress={() => router.back()}
          size={theme.sizes.iconMedium}
        />
        <View pointerEvents="none" style={styles.headerCopy}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            Notas fiscais/boletos
          </Text>
        </View>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  header: { position: 'relative' },
  headerCopy: { alignItems: 'center', left: 0, position: 'absolute', right: 0 },
});
