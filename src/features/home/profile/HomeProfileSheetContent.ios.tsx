import {
  Button,
  Divider,
  HStack,
  Image,
  ScrollView,
  Spacer,
  Text,
  VStack,
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
  glassEffect,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { NativeAvatarButton } from '@/components/native';
import { getLiquidGlassTint, spacing, useAppTheme } from '@/theme';
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

  return (
    <ScrollView showsIndicators={false}>
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          padding({ horizontal: spacing.md, top: spacing.xxxl + spacing.lg, bottom: spacing.xxxl }),
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
        ]}
      >
        <VStack alignment="center" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
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

        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[padding({ top: spacing.xxxl }), frame({ maxWidth: Infinity })]}
        >
          <Button
            modifiers={[
              buttonStyle('plain'),
              frame({ alignment: 'leading', maxWidth: Infinity }),
              glassEffect({
                glass: { interactive: true, variant: 'regular' },
                cornerRadius: theme.radius.xl + spacing.xxs,
                shape: 'roundedRectangle',
              }),
              accessibilityLabel('Informações da conta'),
            ]}
            onPress={() => undefined}
          >
            <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
              <ProfileRow label="Nome" value={displayName} />
              <Divider />
              <ProfileRow label="E-mail" value={email} />
              <Divider />
              <ProfileRow label="Método" value="Google" />
            </VStack>
          </Button>
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

        <Button
          role="destructive"
          modifiers={[
            buttonStyle('glass'),
            controlSize('large'),
            frame({ maxWidth: Infinity }),
            accessibilityLabel(isSigningOut ? 'Saindo da conta' : 'Sair da conta'),
            accessibilityHint('Encerra a sessão atual'),
            ...(isSigningOut ? [disabledModifier(true)] : []),
            padding({ top: spacing.xl }),
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
