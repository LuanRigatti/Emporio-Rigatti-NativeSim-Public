import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';

import SettingsIcon from './SettingsIcon';

export function ProfileHeader() {
  const { theme } = useAppTheme();

  return (
    <View style={styles.section}>
      <Text
        style={[
          theme.typography.caption,
          styles.sectionLabel,
          { color: theme.colors.textSecondary },
        ]}
      >
        PERFIL
      </Text>
      <GlassSurface
        accessibilityLabel="Perfil de João Silva, joao@email.com"
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.glassSurface,
            borderWidth: 0,
            borderRadius: theme.radius.xl + theme.spacing.xs,
            padding: theme.spacing.md,
          },
        ]}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: theme.colors.brand,
              borderRadius: theme.radius.pill,
              height: 56,
              width: 56,
            },
          ]}
        >
          <SettingsIcon
            color={theme.colors.brandStrong}
            fallbackIcon="person-circle-outline"
            size={34}
            systemName="person.crop.circle.fill"
          />
        </View>
        <View style={styles.content}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            João Silva
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            joao@email.com
          </Text>
        </View>
        <SettingsIcon
          color={theme.colors.textTertiary}
          fallbackIcon="chevron-forward"
          size={theme.sizes.iconSmall}
          systemName="chevron.right"
        />
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionLabel: { letterSpacing: 0.7, paddingHorizontal: 4 },
  container: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 2 },
});
