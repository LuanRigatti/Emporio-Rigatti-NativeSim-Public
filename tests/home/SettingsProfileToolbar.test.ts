/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { HomeProfileSheetProvider } from '@/features/home/profile/HomeProfileSheetProvider';
import { SettingsScreen } from '@/features/settings/components/SettingsScreen';

const mockAppMode = { mode: 'wholesale' as 'wholesale' | 'retail' };

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  function Toolbar({ children, ...props }: { children?: ReactNode }) {
    return React.createElement('toolbar', props, children);
  }
  function ToolbarView({ children }: { children?: ReactNode }) {
    return React.createElement('toolbar-view', null, children);
  }
  const toolbar = Object.assign(Toolbar, { View: ToolbarView });
  return { Stack: { Toolbar: toolbar }, useRouter: () => ({ push: jest.fn() }) };
});

jest.mock('@/components/layout', () => ({ NativeGlassHeader: () => null }));
jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeHomeToolbarActions: (props: Record<string, unknown>) =>
      React.createElement('native-home-toolbar-actions', props),
  };
});
jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');
  return {
    PremiumCard: ({ children }: { children?: ReactNode }) =>
      React.createElement('premium-card', null, children),
    PremiumScreen: ({ children }: { children?: ReactNode }) =>
      React.createElement('premium-screen', null, children),
    ProgressiveCollapsibleScreen: ({
      children,
      largeTitle,
    }: {
      children?: ReactNode;
      largeTitle?: ReactNode;
    }) => React.createElement('premium-screen', null, largeTitle, children),
  };
});
jest.mock('@/features/home/profile/HomeProfileSheet', () => {
  const React = require('react') as typeof import('react');
  return {
    HomeProfileSheet: (props: Record<string, unknown>) =>
      React.createElement('home-profile-sheet', props),
  };
});
jest.mock('@/features/settings/components/SettingItem', () => ({ SettingItem: () => null }));
jest.mock('@/features/settings/components/SettingsSection', () => ({
  SettingsSection: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 59 }),
  useAuth: () => ({
    user: { displayName: 'Luan Rigatti', photoUrl: 'https://example.test/avatar.png' },
  }),
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FFFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: { background: '#FFFFFF', surface: '#FFFFFF', textPrimary: '#111111' },
      layout: { tabBarHeight: 80 },
      radius: { xl: 24 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 8, xxs: 4, xxxl: 40 },
    },
  }),
}));

function findNodes(instance: ReactTestInstance, type: string) {
  return instance.findAll((node) => String(node.type) === type);
}

function renderSettings(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(HomeProfileSheetProvider, null, createElement(SettingsScreen)));
  });
  return renderer;
}

describe('Settings profile toolbar', () => {
  it.each(['wholesale', 'retail'] as const)(
    'uses the Home avatar control in the right slot and opens the shared Profile Sheet in %s',
    (mode) => {
      mockAppMode.mode = mode;
      const renderer = renderSettings();
      const toolbar = findNodes(renderer.root, 'toolbar')[0];
      const avatarAction = findNodes(renderer.root, 'native-home-toolbar-actions')[0];

      expect(toolbar.props.placement).toBe('right');
      expect(avatarAction.props).toEqual(
        expect.objectContaining({
          accessibilityHint: 'Exibe os dados da conta e a opção de sair',
          accessibilityLabel: 'Abrir perfil da conta',
          imageUri: 'https://example.test/avatar.png',
          name: 'Luan Rigatti',
          showSearch: false,
        }),
      );

      const profileSheet = findNodes(renderer.root, 'home-profile-sheet')[0];
      expect(profileSheet.props.visible).toBe(false);

      act(() => avatarAction.props.onProfilePress());

      expect(findNodes(renderer.root, 'home-profile-sheet')).toHaveLength(1);
      expect(findNodes(renderer.root, 'home-profile-sheet')[0].props.visible).toBe(true);
    },
  );
});
