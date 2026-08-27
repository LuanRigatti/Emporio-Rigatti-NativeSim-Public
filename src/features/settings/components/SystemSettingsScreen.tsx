import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeSheet } from '@/components/native';
import { PremiumCard, PremiumScreen } from '@/components/premium';
import { useAppTheme } from '@/theme';

import { SettingItem } from './SettingItem';
import { SettingsSection } from './SettingsSection';
import SystemBottomSheetGlassContent from './SystemBottomSheetGlassContent';
import LiquidGlassInteractionExperiment from './SystemLiquidGlassExperiment';

export function SystemSettingsScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);

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
            onPress={() => router.push('/configuracoes/modo-teste')}
            systemName="testtube.2"
            title="Modo Teste"
          />
          <SettingItem
            fallbackIcon="archive-outline"
            isLast
            onPress={() => router.push('/configuracoes/backup')}
            systemName="externaldrive"
            title="Backup"
          />
        </SettingsSection>
      </PremiumCard>
      <LiquidGlassInteractionExperiment
        color={theme.colors.textPrimary}
        cornerRadius={theme.radius.card}
        style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}
        width={Math.max(0, windowWidth - theme.layout.screenHorizontalPadding * 2)}
      />
      <LiquidGlassInteractionExperiment
        color={theme.colors.textPrimary}
        cornerRadius={theme.radius.card}
        onPress={() => setIsBottomSheetVisible(true)}
        style={{ alignSelf: 'stretch', marginTop: theme.spacing.md }}
        title="Teste Bottom Sheet Glass"
        width={Math.max(0, windowWidth - theme.layout.screenHorizontalPadding * 2)}
      />
      <NativeSheet
        onVisibleChange={setIsBottomSheetVisible}
        title="Teste Bottom Sheet Glass"
        visible={isBottomSheetVisible}
      >
        <SystemBottomSheetGlassContent />
      </NativeSheet>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
});
