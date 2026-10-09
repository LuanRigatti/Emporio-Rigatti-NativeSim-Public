import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const tabsLayout = source('src/app/(tabs)/_layout.tsx');
const rootLayout = source('src/app/_layout.tsx');

const triggers = [
  ...tabsLayout.matchAll(/<NativeTabs\.Trigger name="([^"]+)">([\s\S]*?)<\/NativeTabs\.Trigger>/g),
];

describe('Expo Router NativeTabs layout', () => {
  it('declares exactly the four visible tabs in the requested order', () => {
    expect(triggers.map(([, name]) => name)).toEqual([
      'dashboard',
      'financeiro',
      'historico',
      'configuracoes',
    ]);
    expect(
      triggers.map(
        ([, , block]) =>
          (block ?? '').match(
            /<NativeTabs\.Trigger\.Label hidden>(.*?)<\/NativeTabs\.Trigger\.Label>/,
          )?.[1],
      ),
    ).toEqual(['Home', 'Finanças', 'Histórico', 'Configurações']);
    expect(tabsLayout).not.toContain('name="registrar"');
    expect(tabsLayout).not.toContain('Registrar</NativeTabs.Trigger.Label>');
  });

  it('preserves Expo native tabs, hidden labels, existing SF Symbols, and native sizing', () => {
    expect(tabsLayout).toContain("from 'expo-router/unstable-native-tabs'");
    expect(tabsLayout).toContain('labelVisibilityMode="unlabeled"');
    expect(tabsLayout).toContain('tintColor={iconColor}');
    expect(tabsLayout).toContain(
      'nativeContainerStyle: { backgroundColor: theme.colors.background }',
    );
    expect(tabsLayout).toContain("'house', 'house.fill'");
    expect(tabsLayout).toContain("'chart.bar', 'chart.bar.fill'");
    expect(tabsLayout).toContain("'clock', 'clock.fill'");
    expect(tabsLayout).toContain("'gearshape', 'gearshape.fill'");
    expect(tabsLayout).not.toMatch(/tabBarStyle|tabBarHeight|tabBarWidth|width:|height:/);
    expect(tabsLayout).not.toMatch(/Pressable|Touchable|Animated\.View/);
    expect(tabsLayout).toContain('<Stack.Toolbar placement="left">');
    expect(tabsLayout).toContain('<Stack.Toolbar placement="right">');
  });

  it('keeps each NativeTabs destination and the shared Root Native Stack routes', () => {
    const tabRouteFiles = [
      'src/app/(tabs)/dashboard/index.tsx',
      'src/app/(tabs)/financeiro/index.tsx',
      'src/app/(tabs)/historico/index.tsx',
      'src/app/(tabs)/configuracoes/index.tsx',
    ];
    for (const path of tabRouteFiles) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(true);
    }

    expect(rootLayout).toContain('name="(tabs)"');
    for (const route of [
      'registrar-entrega',
      'registrar-entrega/clientes',
      'registrar-entrega/[clientId]',
      'registrar-dados',
      'registrar-pedido-varejo/index',
    ]) {
      expect(rootLayout).toContain(`name="${route}"`);
    }
    expect(rootLayout).toContain('hidesBottomBarWhenPushed: true');
    expect(rootLayout).toMatch(
      /name="registrar-entrega\/clientes"[\s\S]{0,500}gestureEnabled: true/,
    );
    expect(rootLayout).toMatch(/name="registrar-dados"[\s\S]{0,500}gestureEnabled: true/);
    expect(rootLayout).toMatch(
      /name="registrar-pedido-varejo\/index"[\s\S]{0,500}gestureEnabled: true/,
    );
  });

  it('keeps Dados Diários available from Configurações and existing registrar roots', () => {
    const settingsDataRoute = source('src/app/(tabs)/configuracoes/dados.tsx');
    const dailySettingsRoute = source('src/app/(tabs)/configuracoes/dados/diarios.tsx');
    const settingsScreen = source('src/features/settings/components/SettingsScreen.tsx');
    const costsRoute = source('src/app/dados.tsx');
    const registrarDataRoute = source('src/app/registrar-dados.tsx');
    const registrarModule = source('src/app/(tabs)/registrar/index.tsx');

    expect(settingsScreen).toContain("router.push('/dados')");
    expect(settingsDataRoute).toContain("export { default } from '@/app/dados'");
    expect(costsRoute).toContain("daily: '/dados/diarios'");
    expect(dailySettingsRoute).toContain('<CostsEditorScreen mode="daily" nativeHeader />');
    expect(registrarDataRoute).toContain('RegistrarDailyDataScreen');
    expect(registrarModule).toContain('useCostSettings()');
    expect(registrarModule).toContain('<NativeDailyDataSheet');
  });

  it('keeps the Retail success return on Home after removing the Registrar tab', () => {
    const retailOrderScreen = source(
      'src/features/retail-orders/components/RetailOrderStepScreen.tsx',
    );

    expect(retailOrderScreen).toContain("router.dismissTo('/(tabs)/dashboard')");
    expect(retailOrderScreen).not.toContain("router.dismissTo('/registrar')");
  });
});
