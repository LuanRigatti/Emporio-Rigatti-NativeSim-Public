import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SplashGate } from '@/features/splash';
import { useSession } from '@/providers';

export default function PrototypeIndexRoute() {
  const router = useRouter();
  const { checkAuthentication } = useSession();
  const handleSplashComplete = useCallback(
    (isLogged: boolean) => {
      router.replace(isLogged ? '/(tabs)/dashboard' : '/login');
    },
    [router],
  );

  return <SplashGate checkSession={checkAuthentication} onComplete={handleSplashComplete} />;
}
