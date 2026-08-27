import { useCallback, useState } from 'react';

import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';
import { useAuth } from '@/providers';

import HomeProfileSheetContent from './HomeProfileSheetContent';

const PROFILE_SHEET_INITIAL_DETENT = { fraction: 0.58 } as const;
const PROFILE_SHEET_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = [
  PROFILE_SHEET_INITIAL_DETENT,
  'large',
];
type ProfileSheetDetent = NonNullable<NativeBottomSheetProps['detents']>[number];

type Props = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

export function HomeProfileSheet({ onVisibleChange, visible }: Props) {
  const { error, isLoading, signOut, user } = useAuth();
  const [selectedDetent, setSelectedDetent] = useState<ProfileSheetDetent>(
    PROFILE_SHEET_INITIAL_DETENT,
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // SessionProvider preserves the authenticated session and exposes the mapped error.
    }
  }, [signOut]);

  const handleVisibleChange = useCallback(
    (nextVisible: boolean) => {
      if (!nextVisible) setSelectedDetent(PROFILE_SHEET_INITIAL_DETENT);
      onVisibleChange(nextVisible);
    },
    [onVisibleChange],
  );

  const handleDismiss = useCallback(() => {
    handleVisibleChange(false);
  }, [handleVisibleChange]);

  const handlePhotoPress = useCallback(() => {
    setSelectedDetent('large');
  }, []);

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
          isSigningOut={isLoading}
          onPhotoPress={handlePhotoPress}
          onSignOut={() => void handleSignOut()}
        />
      }
      detents={PROFILE_SHEET_DETENTS}
      hostSizing="viewport"
      initialDetent={PROFILE_SHEET_INITIAL_DETENT}
      items={[]}
      onDetentChange={setSelectedDetent}
      onDismiss={handleDismiss}
      onVisibleChange={handleVisibleChange}
      presentationBackgroundMode="transparent"
      selectedDetent={selectedDetent}
      title="Perfil"
      visible={visible}
    />
  );
}
