/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';

import {
  HOME_TOOLBAR_CONTROL_SIZE,
  HOME_TOOLBAR_SEARCH_WIDTH,
} from '@/components/native/NativeHomeToolbarActions/NativeHomeToolbarActions.constants';
import { HomeToolbar, useHomeModeSelector } from '@/components/navigation/HomeToolbar';

const mockSetMode = jest.fn();
const mockRequestModeTransition = jest.fn();
const mockAppMode = {
  mode: 'wholesale' as 'wholesale' | 'retail',
  isReady: true,
  setMode: mockSetMode,
};
let mockResolvedMode: 'light' | 'dark' = 'light';
let mockToolbarMounts = 0;
let mockToolbarUnmounts = 0;

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');

  function MockToolbar({ children, ...props }: { children?: ReactNode }) {
    React.useEffect(() => {
      mockToolbarMounts += 1;
      return () => {
        mockToolbarUnmounts += 1;
      };
    }, []);

    const directChildTypes = React.Children.toArray(children).map((child) => {
      if (!React.isValidElement(child)) return typeof child;
      if (typeof child.type === 'string') return child.type;
      return (child.type as { name?: string }).name ?? 'unknown';
    });

    return React.createElement('toolbar', { ...props, directChildTypes }, children);
  }
  function MockToolbarView({ children, ...props }: { children?: ReactNode }) {
    return React.createElement('toolbar-view', props, children);
  }
  function MockToolbarSpacer(props: { width?: number }) {
    return React.createElement('toolbar-spacer', props);
  }
  function MockToolbarButton({ children, ...props }: { children?: ReactNode }) {
    return React.createElement('toolbar-button', props, children);
  }
  function MockToolbarIcon(props: { sf?: string }) {
    return React.createElement('toolbar-icon', props);
  }
  function MockToolbarLabel({ children }: { children?: ReactNode }) {
    return React.createElement('toolbar-label', null, children);
  }

  const Toolbar = Object.assign(MockToolbar, {
    View: MockToolbarView,
    Spacer: MockToolbarSpacer,
    Button: MockToolbarButton,
    Icon: MockToolbarIcon,
    Label: MockToolbarLabel,
  });

  return { Stack: { Toolbar } };
});

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeButton: (props: Record<string, unknown>) => React.createElement('native-button', props),
    NativeHomeToolbarActions: (props: Record<string, unknown>) =>
      React.createElement('native-home-toolbar-actions', props),
    HOME_TOOLBAR_CONTROL_SIZE: 44,
    NativeModeSheetContent: (props: Record<string, unknown>) =>
      React.createElement('native-mode-sheet-content', props),
    NativeSheet: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('native-sheet', props, children),
  };
});

jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
}));

jest.mock('@/features/home/hooks/useHomeModeTransition', () => ({
  useHomeModeTransition: () => ({
    isTransitioning: false,
    requestModeTransition: mockRequestModeTransition,
  }),
}));

jest.mock('@/theme', () => ({
  getLiquidGlassTint: (mode: 'light' | 'dark') =>
    mode === 'dark' ? 'dark-sheet-tint' : 'light-sheet-tint',
  useAppTheme: () => ({ resolvedMode: mockResolvedMode }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
}));

const mockTriggerLightImpactHaptic = jest.requireMock('@/utils/haptics')
  .triggerLightImpactHaptic as jest.Mock;

function ModeToolbarHarness(props: Omit<ComponentProps<typeof HomeToolbar>, 'modeSelector'>) {
  const modeSelector = useHomeModeSelector();
  return createElement(HomeToolbar, { ...props, modeSelector });
}

function renderToolbar(options: { searchAvailable?: boolean; onSearchPress?: () => void } = {}) {
  let renderer!: ReactTestRenderer;
  const onSearchPress =
    options.searchAvailable === false ? undefined : (options.onSearchPress ?? jest.fn());

  act(() => {
    renderer = create(createElement(ModeToolbarHarness, { onSearchPress }));
  });
  return renderer;
}

function findNodes(instance: ReactTestInstance, type: string) {
  return instance.findAll((node) => String(node.type) === type);
}

function findToolbarAction(instance: ReactTestInstance, mode: string) {
  return findNodes(instance, 'native-home-toolbar-actions').find(
    (node) => node.props.mode === mode,
  );
}

function pressModeAction(renderer: ReactTestRenderer) {
  const action =
    findToolbarAction(renderer.root, 'modeAndSearchActions') ??
    findToolbarAction(renderer.root, 'modeOnlyAction');
  if (!action) throw new Error('Home mode toolbar action was not rendered');
  act(() => action.props.onModePress());
}

describe('HomeToolbar', () => {
  beforeEach(() => {
    mockAppMode.mode = 'wholesale';
    mockResolvedMode = 'light';
    mockToolbarMounts = 0;
    mockToolbarUnmounts = 0;
    mockSetMode.mockClear();
    mockRequestModeTransition.mockClear();
    mockTriggerLightImpactHaptic.mockClear();
  });

  it.each(['wholesale', 'retail'] as const)(
    'passes the current mode to the shared sheet for %s',
    (mode) => {
      mockAppMode.mode = mode;
      const renderer = renderToolbar({ searchAvailable: mode === 'wholesale' });
      const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content');

      expect(modeSheetContent).toHaveLength(1);
      expect(modeSheetContent[0].props.mode).toBe(mode);
    },
  );

  it('renders one Atacado capsule with separate mode and Search actions', () => {
    mockAppMode.mode = 'wholesale';
    const renderer = renderToolbar();
    const action = findToolbarAction(renderer.root, 'modeAndSearchActions');

    expect(action?.props).toEqual(
      expect.objectContaining({
        accessibilityHint: 'Abre o seletor de modo Atacado ou Varejo.',
        accessibilityLabel: 'Alterar modo. Modo atual: Atacado',
        mode: 'modeAndSearchActions',
        onModePress: expect.any(Function),
        onSearchPress: expect.any(Function),
        searchAccessibilityHint: 'Abre a busca de produtos',
        searchAccessibilityLabel: 'Busca',
        toolbarMorphDiagnosticRole: 'home-search',
      }),
    );
    expect(findNodes(renderer.root, 'native-home-toolbar-actions')).toHaveLength(1);
    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(0);
  });

  it('uses a single fixed native Host with two independently labeled 44-point buttons', () => {
    const homeToolbarSource = readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8');
    const nativeActionsSource = readFileSync(
      'src/components/native/NativeHomeToolbarActions/NativeHomeToolbarActionsSwiftUI.ios.tsx',
      'utf8',
    );
    const fallbackActionsSource = readFileSync(
      'src/components/native/NativeHomeToolbarActions/NativeHomeToolbarActionsFallback.tsx',
      'utf8',
    );
    const toolbarConstantsSource = readFileSync(
      'src/components/native/NativeHomeToolbarActions/NativeHomeToolbarActions.constants.ts',
      'utf8',
    );
    const actionStart = nativeActionsSource.indexOf(
      "if (props.mode === 'modeAndSearchActions' || props.mode === 'modeOnlyAction')",
    );
    const profileStart = nativeActionsSource.indexOf('\n  const {', actionStart);
    const modeActionsSource = nativeActionsSource.slice(actionStart, profileStart);

    expect(homeToolbarSource).toContain('<Stack.Toolbar.View hidesSharedBackground>');
    expect(homeToolbarSource).toContain('home-toolbar-item:leading-anchor:44x44');
    expect(homeToolbarSource).toContain('<Stack.Toolbar placement="right">');
    expect(homeToolbarSource).toContain('<Stack.Toolbar.View>');
    expect(homeToolbarSource).toContain('toolbarMorphDiagnosticRole="home-search"');
    expect(homeToolbarSource).not.toContain('<Stack.Toolbar.Button');
    expect(homeToolbarSource).not.toContain('HomeSearchToolbarExperimentSelector');
    expect(modeActionsSource.match(/<Button/g)).toHaveLength(2);
    expect(modeActionsSource.match(/systemName="cube"/g)).toHaveLength(1);
    expect(fallbackActionsSource).toContain('name="cube-outline"');
    expect(modeActionsSource.match(/systemName="magnifyingglass"/g)).toHaveLength(1);
    expect(modeActionsSource).not.toContain('Divider');
    expect(modeActionsSource).not.toContain('opacity(0.55)');
    expect(fallbackActionsSource).not.toContain('styles.divider');
    expect(fallbackActionsSource).toContain(
      "justifyContent: hasSearch ? 'space-between' : 'center'",
    );
    expect(fallbackActionsSource).toContain('width: toolbarWidth');
    expect(modeActionsSource.match(/width: HOME_TOOLBAR_CONTROL_SIZE/g)).toHaveLength(2);
    expect(modeActionsSource.match(/height: HOME_TOOLBAR_CONTROL_SIZE/g)).toHaveLength(5);
    expect(modeActionsSource.match(/font\(\{ size: 22, weight: 'regular' \}\)/g)).toHaveLength(2);
    expect(modeActionsSource).toMatch(
      /<Host\s+style=\{\{ height: HOME_TOOLBAR_CONTROL_SIZE, width: toolbarWidth \}\}/,
    );
    expect(modeActionsSource).toContain('testID="home-toolbar-item:home-actions"');
    expect(modeActionsSource).toContain('collapsable={false}');
    expect(modeActionsSource).toMatch(
      /frame\(\{\s*width: toolbarWidth,\s*height: HOME_TOOLBAR_CONTROL_SIZE,/,
    );
    expect(modeActionsSource).toContain('spacing={actionSpacing}');
    expect(modeActionsSource).toContain('alignment="center"');
    expect(modeActionsSource).toContain(
      'const actionSpacing = hasSearch ? toolbarWidth - 2 * HOME_TOOLBAR_CONTROL_SIZE : 0;',
    );
    const interButtonSpacing = HOME_TOOLBAR_SEARCH_WIDTH - 2 * HOME_TOOLBAR_CONTROL_SIZE;
    const modeCenter = HOME_TOOLBAR_CONTROL_SIZE / 2;
    const searchCenter = HOME_TOOLBAR_SEARCH_WIDTH - HOME_TOOLBAR_CONTROL_SIZE / 2;
    expect(interButtonSpacing).toBe(12);
    expect(2 * HOME_TOOLBAR_CONTROL_SIZE + interButtonSpacing).toBe(100);
    expect(searchCenter - modeCenter).toBe(56);
    expect(modeCenter).toBe(HOME_TOOLBAR_SEARCH_WIDTH - searchCenter);
    expect(interButtonSpacing).toBeGreaterThanOrEqual(0);
    expect(modeActionsSource).toContain("accessibilityIdentifier('home-mode-toolbar')");
    expect(modeActionsSource).toContain("accessibilityIdentifier('home-search-toolbar')");
    expect(modeActionsSource).not.toContain('<Text');
    expect(modeActionsSource).not.toContain('matchContents');
    expect(modeActionsSource).not.toContain('glassEffect');
    expect(modeActionsSource).not.toContain('background(');
    expect(modeActionsSource).toContain('toolbar-morph:${props.toolbarMorphDiagnosticRole}');
    expect(toolbarConstantsSource).toContain('HOME_TOOLBAR_SEARCH_WIDTH = 100');
    expect(findNodes(renderToolbar().root, 'native-button')).toHaveLength(0);
  });

  it('renders only the mode icon in the Retail right slot', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderToolbar({ searchAvailable: false });
    const action = findToolbarAction(renderer.root, 'modeOnlyAction');

    expect(action?.props).toEqual(
      expect.objectContaining({
        accessibilityHint: 'Abre o seletor de modo Atacado ou Varejo.',
        accessibilityLabel: 'Alterar modo. Modo atual: Varejo',
        mode: 'modeOnlyAction',
        onModePress: expect.any(Function),
        toolbarMorphDiagnosticRole: 'home-search',
      }),
    );
    expect(action?.props.onSearchPress).toBeUndefined();
    expect(findNodes(renderer.root, 'native-home-toolbar-actions')).toHaveLength(1);
  });

  it('opens the existing mode sheet and emits its existing light haptic from either toolbar variant', () => {
    for (const mode of ['wholesale', 'retail'] as const) {
      mockAppMode.mode = mode;
      mockTriggerLightImpactHaptic.mockClear();
      const renderer = renderToolbar({ searchAvailable: mode === 'wholesale' });

      expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);
      pressModeAction(renderer);

      expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(true);
      expect(mockTriggerLightImpactHaptic).toHaveBeenCalledTimes(1);
    }
  });

  it('preserves the shared Light Mode tint and mode selector sheet contract', () => {
    const renderer = renderToolbar();
    const modeSheet = findNodes(renderer.root, 'native-sheet')[0];

    expect(modeSheet.props.presentationBackgroundColor).toBeUndefined();
    expect(modeSheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(modeSheet.props.glassSurface).toBe(true);
    expect(modeSheet.props.glassTint).toBe('light-sheet-tint');
    expect(modeSheet.props.detents).toEqual([{ fraction: 0.4 }]);
    expect(modeSheet.props.accessibilityLabel).toBe('Modo de venda');
  });

  it('preserves the shared Dark Mode tint without changing modal dimming', () => {
    mockResolvedMode = 'dark';
    const renderer = renderToolbar();
    const modeSheet = findNodes(renderer.root, 'native-sheet')[0];

    expect(modeSheet.props.presentationBackgroundColor).toBeUndefined();
    expect(modeSheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(modeSheet.props.glassSurface).toBe(true);
    expect(modeSheet.props.glassTint).toBe('dark-sheet-tint');
  });

  it.each([
    ['wholesale', 'retail'],
    ['retail', 'wholesale'],
  ] as const)('requests the %s to %s transition after native sheet dismissal', (from, to) => {
    mockAppMode.mode = from;
    const renderer = renderToolbar({ searchAvailable: from === 'wholesale' });

    pressModeAction(renderer);
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    act(() => modeSheetContent.props.onSelect(to));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockRequestModeTransition).not.toHaveBeenCalled();
    expect(sheet.props.visible).toBe(false);

    act(() => sheet.props.onDismiss());

    expect(mockRequestModeTransition.mock.calls).toEqual([[to]]);
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('closes without writing when the current mode is selected again', () => {
    const renderer = renderToolbar();
    pressModeAction(renderer);
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];

    act(() => modeSheetContent.props.onSelect('wholesale'));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockRequestModeTransition).not.toHaveBeenCalled();
    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);

    act(() => findNodes(renderer.root, 'native-sheet')[0].props.onDismiss());

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockRequestModeTransition).not.toHaveBeenCalled();
  });

  it('does not change mode when the sheet is dismissed without a selection', () => {
    const renderer = renderToolbar();
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    pressModeAction(renderer);
    act(() => sheet.props.onDismiss());

    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('applies a pending mode only once if dismissal is reported more than once', () => {
    const renderer = renderToolbar();
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    pressModeAction(renderer);
    act(() => findNodes(renderer.root, 'native-mode-sheet-content')[0].props.onSelect('retail'));
    act(() => sheet.props.onDismiss());
    act(() => sheet.props.onDismiss());

    expect(mockRequestModeTransition).toHaveBeenCalledTimes(1);
    expect(mockRequestModeTransition).toHaveBeenCalledWith('retail');
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('keeps the neutral 44-point anchor on the left and one native action on the right', () => {
    const renderer = renderToolbar();
    const toolbars = findNodes(renderer.root, 'toolbar');
    const leftToolbar = toolbars.find((toolbar) => toolbar.props.placement === 'left');
    const rightToolbar = toolbars.find((toolbar) => toolbar.props.placement === 'right');

    expect(toolbars).toHaveLength(2);
    expect(leftToolbar?.props.directChildTypes).toEqual(['MockToolbarView']);
    expect(rightToolbar?.props.directChildTypes).toEqual(['MockToolbarView']);
    expect(findNodes(leftToolbar!, 'native-home-toolbar-actions')).toHaveLength(0);
    expect(findNodes(rightToolbar!, 'native-home-toolbar-actions')).toHaveLength(1);
    expect(findNodes(leftToolbar!, 'toolbar-view')[0].props.hidesSharedBackground).toBe(true);
    expect(readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8')).toContain(
      'width: HOME_TOOLBAR_CONTROL_SIZE',
    );
  });

  it('keeps the shared right toolbar mounted while switching between modes', () => {
    const renderer = renderToolbar();
    const initialMounts = mockToolbarMounts;
    const initialUnmounts = mockToolbarUnmounts;
    expect(findToolbarAction(renderer.root, 'modeAndSearchActions')).toBeDefined();

    mockAppMode.mode = 'retail';
    act(() =>
      renderer.update(
        createElement(ModeToolbarHarness, {
          onSearchPress: undefined,
        }),
      ),
    );

    expect(findToolbarAction(renderer.root, 'modeOnlyAction')).toBeDefined();
    expect(findNodes(renderer.root, 'native-home-toolbar-actions')).toHaveLength(1);
    expect(mockToolbarMounts).toBe(initialMounts);
    expect(mockToolbarUnmounts).toBe(initialUnmounts);

    mockAppMode.mode = 'wholesale';
    act(() =>
      renderer.update(
        createElement(ModeToolbarHarness, {
          onSearchPress: jest.fn(),
        }),
      ),
    );

    expect(findToolbarAction(renderer.root, 'modeAndSearchActions')).toBeDefined();
    expect(mockToolbarMounts).toBe(initialMounts);
    expect(mockToolbarUnmounts).toBe(initialUnmounts);
  });

  it('keeps Search limited to Wholesale and routes its independent action to the supplied handler', () => {
    const onSearchPress = jest.fn();
    const renderer = renderToolbar({ onSearchPress });
    const action = findToolbarAction(renderer.root, 'modeAndSearchActions');

    act(() => action?.props.onSearchPress());
    expect(onSearchPress).toHaveBeenCalledTimes(1);

    mockAppMode.mode = 'retail';
    let retailRenderer!: ReactTestRenderer;
    act(() => {
      retailRenderer = create(createElement(ModeToolbarHarness, { onSearchPress: undefined }));
    });
    expect(findToolbarAction(retailRenderer.root, 'modeAndSearchActions')).toBeUndefined();
    expect(findToolbarAction(retailRenderer.root, 'modeOnlyAction')).toBeDefined();

    const dashboardSource = readFileSync('src/app/(tabs)/dashboard/index.tsx', 'utf8');
    const retailHomeSource = readFileSync('src/features/home/components/RetailHome.tsx', 'utf8');
    expect(dashboardSource).toContain('onSearchPress={handleOpenSearch}');
    expect(dashboardSource).toContain("router.push('/pesquisa')");
    expect(retailHomeSource).not.toContain('onSearchPress=');
  });
});
