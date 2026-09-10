import { FactoryRoute } from '@/app/fabrica';

export default function SettingsFactoryRoute() {
  return (
    <FactoryRoute
      nativeHeader
      navigationPaths={{
        bucketValue: '/configuracoes/fabrica/valor-balde',
        purchasesMenu: '/configuracoes/fabrica/compras-menu',
      }}
    />
  );
}
