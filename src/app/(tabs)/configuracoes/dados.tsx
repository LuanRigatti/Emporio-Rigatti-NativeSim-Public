import { CostsSettingsScreen } from '@/features/costs';

export default function CostsSettingsRoute() {
  return (
    <CostsSettingsScreen
      navigationPaths={{
        car: '/configuracoes/dados/carro',
        daily: '/configuracoes/dados/diarios',
        monthly: '/configuracoes/dados/mensais',
      }}
    />
  );
}
