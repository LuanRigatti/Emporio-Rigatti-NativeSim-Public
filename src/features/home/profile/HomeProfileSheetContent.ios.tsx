import {
  Button,
  HStack,
  RNHostView,
  ScrollView,
  Spacer,
  Text,
  TextField,
  type TextFieldRef,
  VStack,
  ZStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  contentShape,
  controlSize,
  cornerRadius,
  disabled as disabledModifier,
  font,
  foregroundColor,
  foregroundStyle,
  frame,
  glassEffect,
  offset,
  padding,
  scrollDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { NativeAvatarButton } from '@/components/native';
import { getCardSurfaceColor, getLiquidGlassTint, spacing, useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import type { HomeProfileSheetContentProps } from './HomeProfileSheetContent';

export default function HomeProfileSheetContent({
  displayName,
  email,
  error,
  imageUri,
  isUpdatingDisplayName = false,
  isSigningOut,
  onDisplayNameChange,
  onPhotoPress,
  onSignOut,
}: HomeProfileSheetContentProps) {
  const { resolvedMode, theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const signOutButtonWidth = width * 0.84;
  const [isEditingName, setIsEditingName] = useState(false);
  const nameDraftRef = useRef(displayName);
  const nameDraftState = useNativeState(displayName);
  const nameFieldRef = useRef<TextFieldRef>(null);

  const beginNameEditing = () => {
    nameDraftRef.current = displayName;
    nameDraftState.set(displayName);
    setIsEditingName(true);
  };

  const cancelNameEditing = () => {
    nameFieldRef.current?.blur();
    setIsEditingName(false);
  };

  const saveName = async () => {
    const nextDisplayName = nameDraftRef.current.trim();
    if (!nextDisplayName || !onDisplayNameChange || isUpdatingDisplayName) return;

    try {
      await onDisplayNameChange(nextDisplayName);
      nameFieldRef.current?.blur();
      setIsEditingName(false);
    } catch {
      // The parent keeps the editor open and exposes the mapped error in the sheet.
    }
  };

  const nameContent = isEditingName ? (
    <VStack
      alignment="center"
      spacing={spacing.sm}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}
    >
      <TextField
        axis="horizontal"
        modifiers={[
          font({ textStyle: 'title2', weight: 'bold', design: 'rounded' }),
          autocorrectionDisabled(true),
          frame({ maxWidth: 300, height: 48, alignment: 'center' }),
          glassEffect({
            glass: { interactive: true, variant: 'regular' },
            cornerRadius: 16,
            shape: 'roundedRectangle',
          }),
          padding({ horizontal: spacing.md }),
          ...(isUpdatingDisplayName ? [disabledModifier(true)] : []),
        ]}
        onTextChange={(value) => {
          nameDraftRef.current = value;
        }}
        placeholder="Nome"
        ref={nameFieldRef}
        text={nameDraftState}
      />
      <HStack alignment="center" spacing={spacing.sm}>
        <Button
          label="Cancelar"
          modifiers={[buttonStyle('glass'), controlSize('small')]}
          onPress={cancelNameEditing}
        />
        <Button
          label="Salvar"
          modifiers={[
            buttonStyle('glassProminent'),
            controlSize('small'),
            ...(isUpdatingDisplayName ? [disabledModifier(true)] : []),
          ]}
          onPress={() => void saveName()}
        />
      </HStack>
    </VStack>
  ) : (
    <Button
      modifiers={[
        buttonStyle('plain'),
        accessibilityLabel(`Editar nome ${displayName}`),
        accessibilityHint('Abre a edição do nome da conta'),
        frame({ maxWidth: Infinity, alignment: 'center' }),
      ]}
      onPress={beginNameEditing}
    >
      <Text
        modifiers={[
          font({ textStyle: 'title2', weight: 'bold', design: 'rounded' }),
          foregroundColor(theme.colors.textPrimary),
        ]}
      >
        {displayName}
      </Text>
    </Button>
  );

  const signOutButton = (
    <Button
      role="destructive"
      modifiers={[
        buttonStyle('plain'),
        controlSize('large'),
        offset({ y: 16 }),
        accessibilityLabel(isSigningOut ? 'Saindo da conta' : 'Sair da conta'),
        accessibilityHint('Encerra a sessão atual'),
        ...(isSigningOut ? [disabledModifier(true)] : []),
      ]}
      onPress={() => {
        if (isSigningOut) return;
        triggerNativeButtonHaptic('light');
        onSignOut();
      }}
    >
      <Text
        modifiers={[
          foregroundStyle(theme.colors.contrastContent),
          padding({ horizontal: 28, vertical: 14 }),
          frame({ width: signOutButtonWidth, height: 58, alignment: 'center' }),
          background(theme.colors.contrastSurface),
          cornerRadius(999),
          contentShape(shapes.capsule()),
        ]}
      >
        {isSigningOut ? 'Saindo...' : 'Sair'}
      </Text>
    </Button>
  );

  return (
    <ScrollView showsIndicators={false} modifiers={[scrollDisabled(true)]}>
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[
          padding({ horizontal: spacing.md, top: spacing.xxl, bottom: spacing.xxxl }),
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
              modifiers={[
                padding({ leading: spacing.xxxl }),
                frame({ maxWidth: Infinity }),
                offset({ y: -6 }),
              ]}
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
            {nameContent}
          </VStack>
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

        <HStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'center' }), padding({ top: spacing.xl })]}
        >
          {signOutButton}
        </HStack>

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
