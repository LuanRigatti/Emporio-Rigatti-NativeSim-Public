import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function SystemSettingsScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();

  const header = <NativeGlassHeader mode="transparent" title="Sistema" />;

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
            fallbackIcon="flask-outline"
            onPress={() => router.push('/modo-teste')}
            systemName="testtube.2"
            title="Modo Teste"
          />
          <SettingItem
            fallbackIcon="archive-outline"
            isLast
            onPress={() => router.push('/backup')}
            systemName="externaldrive"
            title="Backup"
          />
        </SettingsSection>
      </PremiumCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
