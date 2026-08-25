import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { SettingItem } from '@/features/settings/components/SettingItem';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { useAppTheme } from '@/theme';

type CostsSettingsScreenProps = {
  navigationPaths: {
    car: string;
    daily: string;
    monthly: string;
  };
};

export function CostsSettingsScreen({ navigationPaths }: CostsSettingsScreenProps) {
  const { theme } = useAppTheme();
  const router = useRouter();

  const header = <NativeGlassHeader mode="transparent" title="Dados" />;

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <PremiumCard
        style={{
          borderRadius: theme.radius.xl + theme.spacing.md,
          marginTop: theme.spacing.md,
          padding: theme.spacing.sm,
        }}
      >
        <SettingsSection>
          <SettingItem
            fallbackIcon="calendar"
            onPress={() => router.push(navigationPaths.monthly)}
            systemName="calendar"
            title="Dados mensais"
          />
          <SettingItem
            fallbackIcon="calendar"
            onPress={() => router.push(navigationPaths.daily)}
            systemName="calendar.day.timeline.left"
            title="Dados diários"
          />
          <SettingItem
            fallbackIcon="car"
            isLast
            onPress={() => router.push(navigationPaths.car)}
            systemName="car"
            title="Dados do Carro"
          />
        </SettingsSection>
      </PremiumCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
