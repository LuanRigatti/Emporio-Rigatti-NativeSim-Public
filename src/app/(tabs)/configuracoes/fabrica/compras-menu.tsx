import { FactoryPurchasesMenuRoute } from '@/app/fabrica-compras-menu';

export default function SettingsFactoryPurchasesMenuRoute() {
  return (
    <FactoryPurchasesMenuRoute
      nativeHeader
      navigationPaths={{
        register: '/configuracoes/fabrica/compras/registrar',
        purchases: '/configuracoes/fabrica/compras',
      }}
    />
  );
}
