import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const registrarLayout = source('src/app/(tabs)/registrar/_layout.tsx');
const financeLayout = source('src/app/(tabs)/financeiro/_layout.tsx');
const settingsLayout = source('src/app/(tabs)/configuracoes/_layout.tsx');
const rootLayout = source('src/app/_layout.tsx');
const registrarIndex = source('src/app/(tabs)/registrar/index.tsx');
const financeIndex = source('src/app/(tabs)/financeiro/index.tsx');
const settingsScreen = source('src/features/settings/components/SettingsScreen.tsx');
const systemSettingsScreen = source('src/features/settings/components/SystemSettingsScreen.tsx');
const homeShortcutsLayout = source('src/app/(home-shortcuts)/_layout.tsx');

function screenBlock(layout: string, routeName: string) {
  const escapedName = routeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = layout.match(
    new RegExp(`<Stack\\.Screen\\s+name="${escapedName}"[^>]*>([\\s\\S]*?)<\\/Stack\\.Screen>`),
  );

  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

function expectBackButtonMode(layout: string, routeName: string, mode: 'minimal' | 'default') {
  expect(screenBlock(layout, routeName)).toContain(
    `<Stack.Screen.BackButton displayMode="${mode}"`,
  );
}

describe('nested Native Stack back button display modes', () => {
  it('uses minimal arrows for nested Registrar destinations without changing gestures', () => {
    for (const routeName of ['entrega', 'dados']) {
      expectBackButtonMode(registrarLayout, routeName, 'minimal');
      expect(screenBlock(registrarLayout, routeName)).not.toContain('gestureEnabled');
    }

    expect(registrarLayout).toContain('<Stack.Screen name="index"');
    expect(registrarIndex).toContain("router.push('/registrar-entrega')");
    expect(registrarIndex).toContain("router.push('/registrar-dados')");
    expect(rootLayout).toMatch(/name="registrar-entrega"[\s\S]{0,500}gestureEnabled: true/);
    expect(rootLayout).toMatch(/name="registrar-dados"[\s\S]{0,500}gestureEnabled: true/);
  });

  it('uses minimal arrows for nested monthly Finance destinations', () => {
    expectBackButtonMode(financeLayout, 'faturamento-mensal', 'minimal');
    expectBackButtonMode(financeLayout, 'lucro-liquido-mensal', 'minimal');
    expect(screenBlock(financeLayout, 'faturamento-mensal')).not.toContain('gestureEnabled');
    expect(screenBlock(financeLayout, 'lucro-liquido-mensal')).not.toContain('gestureEnabled');

    expect(rootLayout).toMatch(/name="faturamento-mensal"[\s\S]{0,500}gestureEnabled: true/);
    expect(rootLayout).toMatch(/name="lucro-liquido-mensal"[\s\S]{0,500}gestureEnabled: true/);
    expect(financeIndex).toContain("pathname: '/faturamento-mensal'");
    expect(financeIndex).toContain("pathname: '/lucro-liquido-mensal'");
  });

  it('uses minimal arrows on first-level Settings destinations', () => {
    for (const routeName of [
      'clientes',
      'dados-empresa',
      'fabrica',
      'dados',
      'localizacao',
      'estoque',
      'face-id',
      'sistema',
      'localizacao/[routeId]',
    ]) {
      expectBackButtonMode(settingsLayout, routeName, 'minimal');
      expect(screenBlock(settingsLayout, routeName)).not.toContain('gestureEnabled');
    }

    for (const destination of [
      "'/clientes'",
      "router.push('/dados-empresa')",
      "router.push('/fabrica')",
      "router.push('/dados')",
      "router.push('/localizacao')",
      "router.push('/estoque')",
      "router.push('/face-id')",
      "router.push('/sistema')",
    ]) {
      expect(settingsScreen).toContain(destination);
    }
  });

  it('preserves Voltar on deeper Settings destinations', () => {
    for (const routeName of [
      'clientes/[clientId]',
      'dados/mensais',
      'dados/diarios',
      'dados/carro',
      'fabrica/valor-balde',
      'fabrica/compras-menu',
      'fabrica/compras',
      'fabrica/compras/registrar',
      'modo-teste',
      'backup',
    ]) {
      expectBackButtonMode(settingsLayout, routeName, 'default');
      expect(screenBlock(settingsLayout, routeName)).toContain('Voltar');
    }

    for (const routeName of [
      'clientes/novo',
      'clientes/[clientId]',
      'dados/mensais',
      'dados/diarios',
      'dados/carro',
      'fabrica-valor-balde',
      'fabrica-compras-menu',
      'fabrica-compras-registrar',
      'modo-teste',
      'backup',
    ]) {
      expectBackButtonMode(rootLayout, routeName, 'default');
    }

    expect(systemSettingsScreen).toContain("router.push('/modo-teste')");
    expect(systemSettingsScreen).toContain("router.push('/backup')");
  });

  it('preserves Home shortcut toolbar chevrons and configured gesture behavior', () => {
    expect(homeShortcutsLayout.match(/icon="chevron\.left"/g)).toHaveLength(4);
    expect(homeShortcutsLayout).toContain('options={{ gestureEnabled: false }}');
    expect(homeShortcutsLayout).toContain('options={{ gestureEnabled: true }}');
  });
});
