/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { SettingsScreen } from '@/features/settings/components/SettingsScreen';

const mockPush = jest.fn();
const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/components/layout', () => ({
  NativeGlassHeader: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', props);
  },
}));
jest.mock('@/components/premium', () => ({
  PremiumCard: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-card', null, children);
  },
  PremiumScreen: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, children);
  },
}));
jest.mock('@/features/settings/components/SettingItem', () => ({
  SettingItem: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('setting-item', props);
  },
}));
jest.mock('@/features/settings/components/SettingsSection', () => ({
  SettingsSection: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('settings-section', null, children);
  },
}));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: { surface: '#FFFFFF' },
      radius: { xl: 22 },
      spacing: { md: 16, sm: 12, xl: 24, xs: 8, xxxl: 40 },
    },
  }),
}));

function renderSettings(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(SettingsScreen));
  });
  return renderer;
}

function findClientSetting(renderer: ReactTestRenderer): ReactTestInstance {
  return renderer.root
    .findAll((node) => String(node.type) === 'setting-item')
    .find((node) => node.props.title === 'Clientes')!;
}

function findCatalogSetting(renderer: ReactTestRenderer): ReactTestInstance | undefined {
  return renderer.root
    .findAll((node) => String(node.type) === 'setting-item')
    .find((node) => node.props.title === 'Catálogo');
}

function findCostSetting(renderer: ReactTestRenderer): ReactTestInstance | undefined {
  return renderer.root
    .findAll((node) => String(node.type) === 'setting-item')
    .find((node) => node.props.title === 'Custos');
}

describe('SettingsScreen retail client navigation', () => {
  beforeEach(() => {
    mockAppMode.mode = 'wholesale';
    mockPush.mockClear();
  });

  it('keeps the existing wholesale destination', () => {
    const renderer = renderSettings();

    act(() => findClientSetting(renderer).props.onPress());

    expect(mockPush).toHaveBeenCalledWith('/clientes');
  });

  it('uses the isolated retail route when retail mode is active', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderSettings();

    act(() => findClientSetting(renderer).props.onPress());

    expect(mockPush).toHaveBeenCalledWith('/clientes-varejo');
  });

  it('shows the retail catalog entry only in retail mode', () => {
    expect(findCatalogSetting(renderSettings())).toBeUndefined();

    mockAppMode.mode = 'retail';
    const renderer = renderSettings();
    const catalogSetting = findCatalogSetting(renderer);

    expect(catalogSetting).toBeDefined();
    act(() => catalogSetting?.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/catalogo-varejo');
  });

  it('shows the isolated retail costs entry only in retail mode', () => {
    expect(findCostSetting(renderSettings())).toBeUndefined();

    mockAppMode.mode = 'retail';
    const renderer = renderSettings();
    const costSetting = findCostSetting(renderer);

    expect(costSetting).toBeDefined();
    act(() => costSetting?.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/custos-varejo');
  });
});
