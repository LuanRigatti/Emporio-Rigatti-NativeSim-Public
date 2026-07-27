import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PremiumScreen } from '@/components/premium';
import { useSession } from '@/providers';
import { useAppTheme } from '@/theme';

import { LogoutButton } from './LogoutButton';
import { ProfileHeader } from './ProfileHeader';
import { SettingItem } from './SettingItem';
import { SettingsHeader } from './SettingsHeader';
import { SettingsSection } from './SettingsSection';

type SettingsItemData = {
  title: string;
  description?: string;
  systemName: string;
  fallbackIcon: Parameters<typeof SettingItem>[0]['fallbackIcon'];
};

const accountItems: readonly SettingsItemData[] = [
  {
    title: 'Conta Google',
    description: 'Conectado (fictício)',
    systemName: 'person.crop.circle.fill',
    fallbackIcon: 'logo-google',
  },
  {
    title: 'Face ID',
    description: 'Em breve',
    systemName: 'faceid',
    fallbackIcon: 'scan-outline',
  },
];

const preferenceItems: readonly SettingsItemData[] = [
  {
    title: 'Notificações',
    systemName: 'bell',
    fallbackIcon: 'notifications-outline',
  },
  {
    title: 'Tema',
    description: 'Seguir sistema',
    systemName: 'paintbrush',
    fallbackIcon: 'color-palette-outline',
  },
  {
    title: 'Idioma',
    description: 'Português (Brasil)',
    systemName: 'globe',
    fallbackIcon: 'language-outline',
  },
];

const dataItems: readonly SettingsItemData[] = [
  { title: 'Backup', systemName: 'arrow.down.doc', fallbackIcon: 'download-outline' },
  {
    title: 'Sincronização',
    systemName: 'arrow.triangle.2.circlepath',
    fallbackIcon: 'sync-outline',
  },
  { title: 'Armazenamento', systemName: 'internaldrive', fallbackIcon: 'server-outline' },
];

const helpItems: readonly SettingsItemData[] = [
  {
    title: 'Central de Ajuda',
    systemName: 'questionmark.circle',
    fallbackIcon: 'help-circle-outline',
  },
  {
    title: 'Política de Privacidade',
    systemName: 'hand.raised',
    fallbackIcon: 'shield-checkmark-outline',
  },
  { title: 'Termos de Uso', systemName: 'doc.text', fallbackIcon: 'document-text-outline' },
  {
    title: 'Sobre o aplicativo',
    systemName: 'info.circle',
    fallbackIcon: 'information-circle-outline',
  },
];

function SettingsItems({ items }: { items: readonly SettingsItemData[] }) {
  return items.map((item, index) => (
    <SettingItem {...item} isLast={index === items.length - 1} key={item.title} />
  ));
}

export function SettingsScreen() {
  const router = useRouter();
  const { signOutMock } = useSession();
  const { reduceMotionEnabled, theme } = useAppTheme();
  const entrance = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: reduceMotionEnabled
        ? theme.animations.duration.instant
        : theme.animations.duration.standard,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance, reduceMotionEnabled, theme]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: interpolate(entrance.value, [0, 1], [theme.spacing.md, 0]) }],
  }));

  const handleLogout = useCallback(async () => {
    await signOutMock();
    router.replace('/login');
  }, [router, signOutMock]);

  return (
    <PremiumScreen
      contentContainerStyle={[
        styles.content,
        {
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing.xxxl + theme.spacing.xl,
        },
      ]}
    >
      <Animated.View style={[styles.animatedContent, contentStyle]}>
        <SettingsHeader title="Configurações" />
        <ProfileHeader />

        <SettingsSection title="Conta">
          <SettingsItems items={accountItems} />
        </SettingsSection>

        <SettingsSection title="Preferências">
          <SettingsItems items={preferenceItems} />
        </SettingsSection>

        <SettingsSection title="Dados">
          <SettingsItems items={dataItems} />
        </SettingsSection>

        <SettingsSection title="Ajuda">
          <SettingsItems items={helpItems} />
        </SettingsSection>

        <LogoutButton onPress={() => void handleLogout()} />
      </Animated.View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  animatedContent: { gap: 24 },
});
