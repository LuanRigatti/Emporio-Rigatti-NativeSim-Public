import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/feedback';
import { NativeButton } from '@/components/native';
import { getCardSurfaceColor, useAppTheme } from '@/theme';

export type HomeProfileSheetContentProps = {
  displayName: string;
  email: string;
  imageUri?: string;
  isSigningOut: boolean;
  isUpdatingDisplayName?: boolean;
  error?: string | null;
  onDisplayNameChange?: (displayName: string) => Promise<void>;
  onPhotoPress?: () => void;
  onSignOut: () => void;
};

export default function HomeProfileSheetContent({
  displayName,
  email,
  error,
  imageUri,
  isSigningOut,
  onSignOut,
}: HomeProfileSheetContentProps) {
  const { resolvedMode, theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: theme.spacing.xxxl,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xxxl + theme.spacing.lg,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.identity}>
        <Avatar imageUri={imageUri} name={displayName} size="large" />
        <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
          {displayName}
        </Text>
      </View>

      <View style={[styles.section, { marginTop: theme.spacing.xxxl }]}>
        <View
          style={[
            styles.accountCard,
            {
              backgroundColor: getCardSurfaceColor(resolvedMode, theme.colors.surface),
              borderColor: theme.colors.separator,
              borderRadius: theme.radius.xl + theme.spacing.xxs,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <ProfileRow label="Nome" value={displayName} />
          <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
          <ProfileRow label="E-mail" value={email} />
          <View style={[styles.divider, { backgroundColor: theme.colors.separator }]} />
          <ProfileRow label="Método" value="Google" />
        </View>
      </View>

      {error ? (
        <Text
          accessibilityRole="alert"
          style={[
            theme.typography.footnote,
            { color: theme.colors.danger, marginTop: theme.spacing.md },
          ]}
        >
          {error}
        </Text>
      ) : null}

      <NativeButton
        accessibilityHint="Encerra a sessão atual"
        accessibilityLabel={isSigningOut ? 'Saindo da conta' : 'Sair da conta'}
        controlSize="large"
        destructive
        disabled={isSigningOut}
        fallbackIcon="log-out-outline"
        haptic="light"
        label={isSigningOut ? 'Saindo...' : 'Sair'}
        onPress={onSignOut}
        systemImage="rectangle.portrait.and.arrow.right"
        variant="glass"
      />
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md },
      ]}
    >
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text
        numberOfLines={2}
        style={[styles.value, theme.typography.body, { color: theme.colors.textPrimary }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  identity: { alignItems: 'center' },
  section: { width: '100%' },
  accountCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  value: { flex: 1, marginLeft: 16, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
