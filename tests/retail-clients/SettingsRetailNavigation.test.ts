/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { SettingsScreen } from '@/features/settings/components/SettingsScreen';

const mockPush = jest.fn();
const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };

jest.mock('@/features/home/profile/HomeProfileSheetProvider', () => ({
  useHomeProfileSheet: () => ({ openProfileSheet: jest.fn() }),
}));

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  function Toolbar({ children }: { children?: ReactNode }) {
    return React.createElement('toolbar', null, children);
  }
  function ToolbarView({ children }: { children?: ReactNode }) {
    return React.createElement('toolbar-view', null, children);
  }
  return {
    Stack: { Toolbar: Object.assign(Toolbar, { View: ToolbarView }) },
    useRouter: () => ({ push: mockPush }),
  };
});
jest.mock('@/components/layout', () => ({
  NativeGlassHeader: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', props);
  },
}));
jest.mock('@/components/native', () => ({
  NativeHomeToolbarActions: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-home-toolbar-actions', props);
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
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('premium-screen', null, largeTitle, children);
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
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 59 }),
  useAuth: () => ({ user: null }),
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: { surface: '#FFFFFF' },
      layout: { tabBarHeight: 80 },
      radius: { xl: 22 },
      spacing: { lg: 20, md: 16, sm: 12, xl: 24, xs: 8, xxxl: 40 },
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

function findPeekPopLabSetting(renderer: ReactTestRenderer): ReactTestInstance | undefined {
  return renderer.root
    .findAll((node) => String(node.type) === 'setting-item')
    .find((node) => node.props.title === 'Teste de prévia nativa');
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

  it('opens the native preview lab route', () => {
    const renderer = renderSettings();
    const labSetting = findPeekPopLabSetting(renderer);

    expect(labSetting).toBeDefined();
    act(() => labSetting?.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/peek-pop-lab');
  });
});
