import { CostsSettingsScreen } from '@/features/costs';

export default function CostsSettingsRoute() {
  return (
    <CostsSettingsScreen
      navigationPaths={{
        car: '/dados/carro',
        daily: '/dados/diarios',
        monthly: '/dados/mensais',
      }}
    />
  );
}
