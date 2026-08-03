import { useRouter } from 'expo-router';

import { RegistrarDeliveryScreen } from './(tabs)/registrar';

export default function RegistrarDeliveryRoute() {
  const router = useRouter();

  return <RegistrarDeliveryScreen onBack={() => router.back()} />;
}
