import { useRouter } from 'expo-router';

import { RegistrarDailyDataScreen } from './(tabs)/registrar';

export default function RegistrarDailyDataRoute() {
  const router = useRouter();

  return <RegistrarDailyDataScreen onBack={() => router.back()} />;
}
