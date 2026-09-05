import {
  Button,
  HStack,
  Image,
  RNHostView,
  ScrollView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  offset,
  padding,
  scrollDisabled,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { NativeAvatarButton } from '@/components/native';
import { getCardSurfaceColor, getLiquidGlassTint, spacing, useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import type { HomeProfileSheetContentProps } from './HomeProfileSheetContent';

export default function HomeProfileSheetContent({
  displayName,
  email,
  error,
  imageUri,
  isSigningOut,
  onPhotoPress,
  onSignOut,
}: HomeProfileSheetContentProps) {
  const { resolvedMode, theme } = useAppTheme();

  const signOutButton = (
    <Button
      role="destructive"
      modifiers={[
        buttonStyle('glass'),
        controlSize('large'),
        accessibilityLabel(isSigningOut ? 'Saindo da conta' : 'Sair da conta'),
        accessibilityHint('Encerra a sessão atual'),
        ...(isSigningOut ? [disabledModifier(true)] : []),
        offset({ y: -40 }),
      ]}
      onPress={() => {
        if (isSigningOut) return;
        triggerNativeButtonHaptic('light');
        onSignOut();
      }}
    >
      <HStack alignment="center" spacing={spacing.xs}>
        <Image
          color={theme.colors.danger}
          size={18}
          systemName="rectangle.portrait.and.arrow.right"
        />
        <Text
          modifiers={[
            font({ textStyle: 'headline', design: 'rounded' }),
            foregroundColor(theme.colors.danger),
          ]}
        >
          {isSigningOut ? 'Saindo...' : 'Sair'}
        </Text>
      </HStack>
    </Button>
  );

  return (
    <ScrollView showsIndicators={false} modifiers={[scrollDisabled(true)]}>
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          padding({ horizontal: spacing.md, top: spacing.xxxl + spacing.lg, bottom: spacing.xxxl }),
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        ]}
      >
        <ZStack alignment="topTrailing" modifiers={[frame({ maxWidth: Infinity })]}>
          <VStack
            alignment="center"
            spacing={8}
            modifiers={[
              frame({ maxWidth: Infinity }),
              padding({ top: spacing.sm }),
              offset({ y: 16 }),
            ]}
          >
            <HStack
              alignment="center"
              spacing={0}
              modifiers={[padding({ leading: spacing.xxxl }), frame({ maxWidth: Infinity })]}
            >
              <NativeAvatarButton
                accessibilityHint="Expande o painel do perfil"
                accessibilityLabel="Expandir perfil"
                avatarSize="large"
                containerSize={theme.sizes.avatarLarge}
                glassTint={getLiquidGlassTint(resolvedMode)}
                imageUri={imageUri}
                name={displayName}
                onPress={() => onPhotoPress?.()}
              />
            </HStack>
            <Text
              modifiers={[
                font({ textStyle: 'title2', weight: 'bold', design: 'rounded' }),
                foregroundColor(theme.colors.textPrimary),
                frame({ maxWidth: Infinity, alignment: 'center' }),
              ]}
            >
              {displayName}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: 'subheadline', design: 'rounded' }),
                foregroundColor(theme.colors.textSecondary),
                frame({ maxWidth: Infinity, alignment: 'center' }),
              ]}
            >
              {email}
            </Text>
          </VStack>
          {signOutButton}
        </ZStack>

        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            padding({ top: spacing.xxl }),
            frame({ maxWidth: Infinity }),
            offset({ y: 16 }),
          ]}
        >
          <ZStack
            alignment="topLeading"
            modifiers={[
              frame({ alignment: 'leading', maxWidth: Infinity }),
              accessibilityLabel('Informações da conta'),
            ]}
          >
            <RNHostView matchContents={false}>
              <View
                pointerEvents="none"
                style={[styles.accountSurface, { borderColor: theme.colors.separator }]}
              >
                {resolvedMode !== 'dark' ? (
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.lightAccountSurface]}
                  />
                ) : null}
                {resolvedMode === 'dark' ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: getCardSurfaceColor(resolvedMode, '#FFFFFF') },
                    ]}
                  />
                ) : null}
              </View>
            </RNHostView>
            <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
              <ProfileRow label="Nome" value={displayName} />
              <ProfileRow label="E-mail" value={email} />
              <ProfileRow label="Método" value="Google" />
            </VStack>
          </ZStack>
        </VStack>

        {error ? (
          <Text
            modifiers={[
              font({ textStyle: 'footnote', design: 'rounded' }),
              foregroundColor(theme.colors.danger),
              padding({ top: spacing.md }),
            ]}
          >
            {error}
          </Text>
        ) : null}

      </VStack>
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <HStack
      alignment="center"
      spacing={spacing.sm}
      modifiers={[padding({ horizontal: spacing.md, vertical: spacing.md })]}
    >
      <Text
        modifiers={[
          font({ textStyle: 'body', design: 'rounded' }),
          foregroundColor(theme.colors.textSecondary),
        ]}
      >
        {label}
      </Text>
      <Spacer />
      <Text
        modifiers={[
          font({ textStyle: 'body', design: 'rounded' }),
          foregroundColor(theme.colors.textPrimary),
          frame({ maxWidth: 220, alignment: 'trailing' }),
        ]}
      >
        {value}
      </Text>
    </HStack>
  );
}

const styles = StyleSheet.create({
  accountSurface: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  lightAccountSurface: {
    backgroundColor: '#FFFFFF',
  },
});
