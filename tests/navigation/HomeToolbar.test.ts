/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, Fragment, type ComponentProps, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';

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
  useAppTheme: () => ({ resolvedMode: mockResolvedMode }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
}));

const mockTriggerLightImpactHaptic = jest.requireMock('@/utils/haptics')
  .triggerLightImpactHaptic as jest.Mock;

function ModeToolbarHarness(props: Omit<ComponentProps<typeof HomeToolbar>, 'modeSelector'>) {
  const modeSelector = useHomeModeSelector();
  return createElement(
    Fragment,
    null,
    createElement(HomeToolbar, { ...props, modeSelector }),
    createElement('mode-selector-trigger', { onPress: modeSelector.open }),
  );
}

function renderToolbar(options: { searchAvailable?: boolean } = {}): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(ModeToolbarHarness, {
        onSearchPress: options.searchAvailable === false ? undefined : jest.fn(),
      }),
    );
  });
  return renderer;
}

function findNodes(instance: ReactTestInstance, type: string) {
  return instance.findAll((node) => String(node.type) === type);
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
    'passes the current mode to the sheet for %s',
    (mode) => {
      mockAppMode.mode = mode;
      const renderer = renderToolbar();
      const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content');

      expect(modeSheetContent).toHaveLength(1);
      expect(modeSheetContent[0].props.mode).toBe(mode);
    },
  );

  it('keeps the right slot as Busca with magnifyingglass for Wholesale', () => {
    mockAppMode.mode = 'wholesale';
    const renderer = renderToolbar();

    const action = findNodes(renderer.root, 'native-home-toolbar-actions').find(
      (node) => node.props.mode === 'searchAction',
    );
    expect(action?.props).toEqual(
      expect.objectContaining({
        mode: 'searchAction',
        name: '',
        onSearchPress: expect.any(Function),
        searchAccessibilityHint: 'Abre a busca de produtos',
        searchAccessibilityLabel: 'Busca',
      }),
    );
    expect(
      readFileSync(
        'src/components/native/NativeHomeToolbarActions/NativeHomeToolbarActionsSwiftUI.ios.tsx',
        'utf8',
      ),
    ).toContain('systemImage="magnifyingglass"');
    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(0);
  });

  it('uses a fixed-size native SwiftUI custom view for Search without matchContents', () => {
    const homeToolbarSource = readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8');
    const nativeActionsSource = readFileSync(
      'src/components/native/NativeHomeToolbarActions/NativeHomeToolbarActionsSwiftUI.ios.tsx',
      'utf8',
    );
    const toolbarConstantsSource = readFileSync(
      'src/components/native/NativeHomeToolbarActions/NativeHomeToolbarActions.constants.ts',
      'utf8',
    );
    const searchModeStart = nativeActionsSource.indexOf("if (mode === 'searchAction')");
    const profileModeStart = nativeActionsSource.indexOf('const toolbarWidth', searchModeStart);
    const searchModeSource = nativeActionsSource.slice(searchModeStart, profileModeStart);

    expect(homeToolbarSource).not.toContain('leading-anchor');
    expect(homeToolbarSource).not.toContain('<Stack.Toolbar placement="left">');
    expect(homeToolbarSource).toContain('mode="searchAction"');
    expect(homeToolbarSource).not.toContain('<Stack.Toolbar.Button');
    expect(searchModeSource).toContain('width: HOME_TOOLBAR_SEARCH_WIDTH');
    expect(searchModeSource).toContain('height: HOME_TOOLBAR_CONTROL_SIZE');
    expect(searchModeSource).toContain("buttonStyle('plain')");
    expect(searchModeSource).toContain('label="Busca"');
    expect(searchModeSource).toContain('systemImage="magnifyingglass"');
    expect(searchModeSource).not.toContain('matchContents');
    expect(searchModeSource).not.toContain('glassEffect');
    expect(searchModeSource).not.toContain('background(');
    expect(toolbarConstantsSource).toContain('HOME_TOOLBAR_SEARCH_WIDTH = 94');
    expect(findNodes(renderToolbar().root, 'native-button')).toHaveLength(0);
  });

  it('does not render a right Search item for Retail', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderToolbar({ searchAvailable: false });

    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(0);
    expect(
      findNodes(renderer.root, 'native-home-toolbar-actions').some(
        (node) => node.props.mode === 'searchAction',
      ),
    ).toBe(false);
  });

  it('keeps the NativeSheet available to the shared mode selector controller', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);

    act(() => trigger.props.onPress());

    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(true);
  });

  it('uses the 85% scoped Light Mode tint and preserves the mode selector sheet contract', () => {
    const renderer = renderToolbar();
    const modeSheet = findNodes(renderer.root, 'native-sheet')[0];

    expect(modeSheet.props.presentationBackgroundColor).toBeUndefined();
    expect(modeSheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(modeSheet.props.glassSurface).toBe(true);
    expect(modeSheet.props.glassTint).toBe('rgba(242, 244, 245, 0.85)');
    expect(modeSheet.props.detents).toEqual([{ fraction: 0.25 }]);
    expect(modeSheet.props.accessibilityLabel).toBe('Modo de venda');
  });

  it('uses 82% dark gray native Glass tint without changing modal dimming in Dark Mode', () => {
    mockResolvedMode = 'dark';
    const renderer = renderToolbar();
    const modeSheet = findNodes(renderer.root, 'native-sheet')[0];

    expect(modeSheet.props.presentationBackgroundColor).toBeUndefined();
    expect(modeSheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(modeSheet.props.glassSurface).toBe(true);
    expect(modeSheet.props.glassTint).toBe('rgba(28, 28, 30, 0.82)');
  });

  it('emits one light haptic when opening the mode selector', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());

    expect(mockTriggerLightImpactHaptic).toHaveBeenCalledTimes(1);
  });

  it('requests the mode transition only after native dismissal from Wholesale to Retail', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    act(() => modeSheetContent.props.onSelect('retail'));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockRequestModeTransition).not.toHaveBeenCalled();
    expect(sheet.props.visible).toBe(false);

    act(() => sheet.props.onDismiss());

    expect(mockRequestModeTransition.mock.calls).toEqual([['retail']]);
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('requests the mode transition only after native dismissal from Retail to Wholesale', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderToolbar({ searchAvailable: false });
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    act(() => modeSheetContent.props.onSelect('wholesale'));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(sheet.props.visible).toBe(false);

    act(() => sheet.props.onDismiss());

    expect(mockRequestModeTransition.mock.calls).toEqual([['wholesale']]);
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('closes without writing when the current mode is selected again', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());
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
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    act(() => trigger.props.onPress());
    act(() => sheet.props.onDismiss());

    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('applies a pending mode only once if dismissal is reported more than once', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    act(() => trigger.props.onPress());
    act(() => findNodes(renderer.root, 'native-mode-sheet-content')[0].props.onSelect('retail'));

    act(() => sheet.props.onDismiss());
    act(() => sheet.props.onDismiss());

    expect(mockRequestModeTransition).toHaveBeenCalledTimes(1);
    expect(mockRequestModeTransition).toHaveBeenCalledWith('retail');
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  it('does not install a Home leading custom item that can morph into the native BackButton', () => {
    const renderer = renderToolbar();
    const toolbars = findNodes(renderer.root, 'toolbar');
    const homeToolbarSource = readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8');

    expect(toolbars.map((toolbar) => toolbar.props.placement)).toEqual(['right']);
    expect(homeToolbarSource).not.toContain('home-toolbar-item:leading-anchor');
    expect(homeToolbarSource).not.toContain('placement="left"');
  });

  it('keeps Search on the right as the only Home toolbar item', () => {
    const renderer = renderToolbar();
    const toolbars = findNodes(renderer.root, 'toolbar');

    expect(toolbars).toHaveLength(1);
    const rightToolbar = toolbars[0];

    expect(rightToolbar.props.placement).toBe('right');
    expect(rightToolbar?.props.directChildTypes).toEqual(['MockToolbarView']);
    expect(findNodes(rightToolbar!, 'native-home-toolbar-actions')[0].props.mode).toBe(
      'searchAction',
    );
  });

  it('keeps toolbar mounts stable while the Wholesale search action updates', () => {
    const renderer = renderToolbar();
    const initialMounts = mockToolbarMounts;
    const initialUnmounts = mockToolbarUnmounts;
    expect(findNodes(renderer.root, 'native-home-toolbar-actions')).toHaveLength(1);

    act(() =>
      renderer.update(
        createElement(ModeToolbarHarness, {
          onSearchPress: jest.fn(),
        }),
      ),
    );

    expect(findNodes(renderer.root, 'native-home-toolbar-actions')).toHaveLength(1);
    expect(findNodes(renderer.root, 'native-home-toolbar-actions')[0].props.mode).toBe(
      'searchAction',
    );
    expect(mockToolbarMounts).toBe(initialMounts);
    expect(mockToolbarUnmounts).toBe(initialUnmounts);
  });

  it('keeps the Search control conditional on the canonical Home handler', () => {
    const renderer = renderToolbar({ searchAvailable: false });

    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(0);
    expect(
      findNodes(renderer.root, 'native-home-toolbar-actions').some(
        (node) => node.props.mode === 'searchAction',
      ),
    ).toBe(false);
  });

  it('routes the right toolbar action to the canonical Home Search handler', () => {
    const onSearchPress = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(ModeToolbarHarness, {
          onSearchPress,
        }),
      );
    });

    const searchAction = findNodes(renderer.root, 'native-home-toolbar-actions').find(
      (node) => node.props.mode === 'searchAction',
    );
    act(() => searchAction?.props.onSearchPress());

    expect(onSearchPress).toHaveBeenCalledTimes(1);
  });
});
