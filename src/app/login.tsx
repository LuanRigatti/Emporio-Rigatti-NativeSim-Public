import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { LoginScreen } from '@/features/login';

export default function LoginRoute() {
  const router = useRouter();
  const handleAuthenticated = useCallback(() => {
    router.replace('/(tabs)/dashboard');
  }, [router]);

  return <LoginScreen onAuthenticated={handleAuthenticated} />;
}
