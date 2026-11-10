import { RegistrarDeliveryScreen } from '@/app/(tabs)/registrar/index';

export default function RegistrarDeliveryClientsRoute() {
  return (
    <RegistrarDeliveryScreen
      inlineClientSelection
      releaseNavigationGuardOnTransitionEnd
      showClientSearch={false}
      showLargeTitle
    />
  );
}
