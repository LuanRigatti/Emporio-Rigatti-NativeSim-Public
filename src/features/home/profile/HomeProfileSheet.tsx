import { useCallback, useState } from 'react';

import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';
import { useAuth } from '@/providers';
import { registrarDeliveryDarkLiquidGlassTint, useAppTheme } from '@/theme';

import HomeProfileSheetContent from './HomeProfileSheetContent';

const PROFILE_SHEET_INITIAL_DETENT = { fraction: 0.5 } as const;
const PROFILE_SHEET_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = [
  PROFILE_SHEET_INITIAL_DETENT,
];

type Props = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

export function HomeProfileSheet({ onVisibleChange, visible }: Props) {
  const { error, isLoading, signOut, updateDisplayName, user } = useAuth();
  const { resolvedMode } = useAppTheme();
  const useDarkGlassSurface = resolvedMode === 'dark';
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // SessionProvider preserves the authenticated session and exposes the mapped error.
    }
  }, [signOut]);

  const handleDismiss = useCallback(() => {
    onVisibleChange(false);
  }, [onVisibleChange]);

  const handleDisplayNameChange = useCallback(
    async (nextDisplayName: string) => {
      setIsUpdatingDisplayName(true);
      try {
        await updateDisplayName(nextDisplayName);
      } finally {
        setIsUpdatingDisplayName(false);
      }
    },
    [updateDisplayName],
  );

  if (!user) return null;

  const displayName = user.displayName?.trim() || 'Conta';
  const email = user.email?.trim() || 'E-mail não disponível';

  return (
    <NativeBottomSheet
      content={
        <HomeProfileSheetContent
          displayName={displayName}
          email={email}
          error={error}
          imageUri={user.photoUrl ?? undefined}
          isUpdatingDisplayName={isUpdatingDisplayName}
          isSigningOut={isLoading}
          onDisplayNameChange={handleDisplayNameChange}
          onSignOut={() => void handleSignOut()}
        />
      }
      detents={PROFILE_SHEET_DETENTS}
      hostSizing="viewport"
      initialDetent={PROFILE_SHEET_INITIAL_DETENT}
      items={[]}
      onDismiss={handleDismiss}
      onVisibleChange={onVisibleChange}
      glassSurface={useDarkGlassSurface}
      glassTint={useDarkGlassSurface ? registrarDeliveryDarkLiquidGlassTint : undefined}
      presentationBackgroundMode="transparent"
      title="Perfil"
      visible={visible}
    />
  );
}
