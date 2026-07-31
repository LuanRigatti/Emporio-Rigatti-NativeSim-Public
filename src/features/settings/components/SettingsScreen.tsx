import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { SettingsHeader } from './SettingsHeader';
import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';

export function SettingsScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        { gap: theme.spacing.xxxl, paddingTop: theme.spacing.sm },
      ]}
    >
      <SettingsHeader title="Configurações" />
      <SettingsSection>
        <SettingItem
          fallbackIcon="person"
          isLast
          onPress={() => router.push('/clientes')}
          systemName="person.2"
          title="Clientes"
        />
      </SettingsSection>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
