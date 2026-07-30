import { StyleSheet } from 'react-native';

import { PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { SettingsHeader } from './SettingsHeader';

export function SettingsScreen() {
  const { theme } = useAppTheme();

  return (
    <PremiumScreen contentContainerStyle={[styles.content, { paddingTop: theme.spacing.sm }]}>
      <SettingsHeader title="Configurações" />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
