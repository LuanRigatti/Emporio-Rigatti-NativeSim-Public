import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SegmentedControl, SwitchField } from '@/components';
import {
  GlassHeader,
  GlassTabBar,
  type GlassTabBarItem,
  PremiumScreen,
  PremiumSection,
} from '@/components/premium';
import { useAppTheme, useVisualCapabilities, type ThemeMode } from '@/theme';
import { AppText } from '@/components/typography/Typography';

type ShowcaseTab = 'Dashboard' | 'Financeiro' | 'Registrar' | 'Historico';

const themeOptions: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const showcaseTabs: readonly {
  key: ShowcaseTab;
  label: string;
  icon: GlassTabBarItem['icon'];
}[] = [
  { key: 'Dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'Financeiro', label: 'Finanças', icon: 'stats-chart' },
  { key: 'Registrar', label: 'Registrar', icon: 'add-circle' },
  { key: 'Historico', label: 'Histórico', icon: 'time-outline' },
];

export function PremiumTabBarShowcase() {
  const { theme, mode, setMode } = useAppTheme();
  const capabilities = useVisualCapabilities();
  const [selectedTab, setSelectedTab] = useState<ShowcaseTab>('Dashboard');
  const [reduceMotionSimulated, setReduceMotionSimulated] = useState(false);

  const items = useMemo<GlassTabBarItem[]>(
    () =>
      showcaseTabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        icon: tab.icon,
        selected: selectedTab === tab.key,
        onPress: () => setSelectedTab(tab.key),
      })),
    [selectedTab],
  );

  const fallback = capabilities.useGlass ? 'native-glass' : capabilities.useBlur ? 'blur' : 'solid';

  return (
    <PremiumScreen>
      <GlassHeader title="Premium Tab Bar" />
      <View style={{ gap: theme.spacing.section }}>
        <PremiumSection title="Tema">
          <SegmentedControl options={themeOptions} value={mode} onChange={setMode} />
        </PremiumSection>

        <PremiumSection title="Capacidades visuais">
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="headline">Fallback ativo: {fallback}</AppText>
            <AppText variant="footnote">
              Liquid Glass disponível: {capabilities.isLiquidGlassAvailable ? 'sim' : 'não'}
            </AppText>
            <AppText variant="footnote">
              Reduce Transparency: {capabilities.reduceTransparencyEnabled ? 'ativo' : 'inativo'}
            </AppText>
          </View>
        </PremiumSection>

        <PremiumSection title="Movimento">
          <SwitchField
            label="Simular Reduce Motion"
            onValueChange={setReduceMotionSimulated}
            value={reduceMotionSimulated}
          />
        </PremiumSection>

        <PremiumSection title="Interação">
          <AppText variant="body">
            Toque rapidamente nas quatro abas para validar a cápsula móvel, a compressão, o spring e
            o feedback tátil.
          </AppText>
          <View
            style={{
              marginHorizontal: theme.spacing.xs,
              marginTop: theme.spacing.lg,
              paddingBottom: theme.spacing.xl,
            }}
          >
            <GlassTabBar items={items} reduceMotionOverride={reduceMotionSimulated} />
          </View>
          <AppText variant="footnote">Aba selecionada: {selectedTab}</AppText>
        </PremiumSection>
      </View>
    </PremiumScreen>
  );
}
