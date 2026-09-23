/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, Fragment, type ComponentProps, type ReactNode } from 'react';

import { HomeToolbar, useHomeModeSelector } from '@/components/navigation/HomeToolbar';

const mockSetMode = jest.fn();
const mockAppMode = {
  mode: 'wholesale' as 'wholesale' | 'retail',
  isReady: true,
  setMode: mockSetMode,
};
const mockThemeState = { resolvedMode: 'light' as 'light' | 'dark' };
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
    Button: MockToolbarButton,
    Icon: MockToolbarIcon,
    Label: MockToolbarLabel,
  });

  return { Stack: { Toolbar } };
});

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');
  return {
    NativeHomeToolbarActions: (props: Record<string, unknown>) =>
      React.createElement('native-home-toolbar-actions', props),
    NativeModeSheetContent: (props: Record<string, unknown>) =>
      React.createElement('native-mode-sheet-content', props),
    NativeSheet: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('native-sheet', props, children),
  };
});

jest.mock('@/providers', () => ({
  useAppMode: () => mockAppMode,
}));

jest.mock('@/theme', () => ({
  registrarDeliveryDarkLiquidGlassTint: 'shared-dark-liquid-glass-tint',
  useAppTheme: () => ({ resolvedMode: mockThemeState.resolvedMode }),
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
        foregroundColor: '#000000',
        imageUri: null,
        name: 'Conta',
        onProfilePress: jest.fn(),
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
    mockToolbarMounts = 0;
    mockToolbarUnmounts = 0;
    mockSetMode.mockClear();
    mockTriggerLightImpactHaptic.mockClear();
    mockThemeState.resolvedMode = 'light';
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

  it('keeps the right slot as Pesquisa for Wholesale', () => {
    mockAppMode.mode = 'wholesale';
    const renderer = renderToolbar();

    const button = findNodes(renderer.root, 'toolbar-button')[0];
    expect(findNodes(button, 'toolbar-icon')[0].props.sf).toBe('magnifyingglass');
    expect(findNodes(button, 'toolbar-label')[0].props.children).toBe('PESQUISA');
  });

  it('does not render a right Search item for Retail', () => {
    mockAppMode.mode = 'retail';
    const renderer = renderToolbar({ searchAvailable: false });

    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(0);
    expect(findNodes(renderer.root, 'toolbar-icon')).toHaveLength(0);
    expect(findNodes(renderer.root, 'toolbar-label')).toHaveLength(0);
  });

  it('keeps the NativeSheet available to the shared mode selector controller', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);

    act(() => trigger.props.onPress());

    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(true);
  });

  it('opts the mode selector into the shared dark Liquid Glass surface only in Dark Mode', () => {
    mockThemeState.resolvedMode = 'dark';
    const darkRenderer = renderToolbar();
    const darkSheet = findNodes(darkRenderer.root, 'native-sheet')[0];

    expect(darkSheet.props.glassSurface).toBe(true);
    expect(darkSheet.props.glassTint).toBe('shared-dark-liquid-glass-tint');

    mockThemeState.resolvedMode = 'light';
    const lightRenderer = renderToolbar();
    const lightSheet = findNodes(lightRenderer.root, 'native-sheet')[0];

    expect(lightSheet.props.glassSurface).toBe(false);
    expect(lightSheet.props.glassTint).toBeUndefined();
  });

  it('emits one light haptic when opening the mode selector', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());

    expect(mockTriggerLightImpactHaptic).toHaveBeenCalledTimes(1);
  });

  it('waits for native dismissal before switching from Wholesale to Retail', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];
    const sheet = findNodes(renderer.root, 'native-sheet')[0];

    act(() => modeSheetContent.props.onSelect('retail'));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(sheet.props.visible).toBe(false);

    act(() => sheet.props.onDismiss());

    expect(mockSetMode.mock.calls).toEqual([['retail']]);
  });

  it('waits for native dismissal before switching from Retail to Wholesale', () => {
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

    expect(mockSetMode.mock.calls).toEqual([['wholesale']]);
  });

  it('closes without writing when the current mode is selected again', () => {
    const renderer = renderToolbar();
    const trigger = findNodes(renderer.root, 'mode-selector-trigger')[0];

    act(() => trigger.props.onPress());
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];

    act(() => modeSheetContent.props.onSelect('wholesale'));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);

    act(() => findNodes(renderer.root, 'native-sheet')[0].props.onDismiss());

    expect(mockSetMode).not.toHaveBeenCalled();
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

    expect(mockSetMode).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith('retail');
  });

  it('keeps Home actions on the left beside the search button', () => {
    const renderer = renderToolbar();
    const modeButtons = findNodes(renderer.root, 'toolbar-button');
    const toolbarViews = findNodes(renderer.root, 'toolbar-view');

    expect(modeButtons).toHaveLength(1);
    expect(toolbarViews).toHaveLength(1);
    expect(findNodes(toolbarViews[0], 'native-home-toolbar-actions')).toHaveLength(1);
    expect(findNodes(modeButtons[0], 'toolbar-label')[0].props.children).toBe('PESQUISA');
  });

  it('renders Home actions on the left and the search button on the right', () => {
    const renderer = renderToolbar();
    const toolbars = findNodes(renderer.root, 'toolbar');

    expect(toolbars).toHaveLength(2);
    const leftToolbar = toolbars.find((toolbar) => toolbar.props.placement === 'left');
    const rightToolbar = toolbars.find((toolbar) => toolbar.props.placement === 'right');

    expect(leftToolbar?.props.directChildTypes).toEqual(['MockToolbarView']);
    expect(rightToolbar?.props.directChildTypes).toEqual(['MockToolbarButton']);
    expect(findNodes(leftToolbar!, 'native-home-toolbar-actions')).toHaveLength(1);
    expect(findNodes(rightToolbar!, 'toolbar-label')[0].props.children).toBe('PESQUISA');
  });

  it('keeps the Home actions structure stable while the Wholesale search slot updates', () => {
    const renderer = renderToolbar();
    const initialMounts = mockToolbarMounts;
    const initialUnmounts = mockToolbarUnmounts;
    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(1);
    expect(findNodes(renderer.root, 'toolbar-label')[0].props.children).toBe('PESQUISA');

    act(() =>
      renderer.update(
        createElement(ModeToolbarHarness, {
          foregroundColor: '#000000',
          imageUri: null,
          name: 'Conta',
          onProfilePress: jest.fn(),
          onSearchPress: jest.fn(),
        }),
      ),
    );

    expect(findNodes(renderer.root, 'toolbar-button')).toHaveLength(1);
    expect(findNodes(renderer.root, 'toolbar-label')[0].props.children).toBe('PESQUISA');
    expect(findNodes(renderer.root, 'native-home-toolbar-actions')).toHaveLength(1);
    expect(mockToolbarMounts).toBe(initialMounts);
    expect(mockToolbarUnmounts).toBe(initialUnmounts);
  });

  it.each(['wholesale', 'retail'] as const)(
    'keeps only the avatar in the left slot for %s',
    (mode) => {
      mockAppMode.mode = mode;
      const renderer = renderToolbar({ searchAvailable: mode === 'wholesale' });
      const actions = findNodes(renderer.root, 'native-home-toolbar-actions')[0];

      expect(actions.props.showSearch).toBe(false);
      expect(actions.props.onSearchPress).toBeUndefined();
    },
  );

  it('routes the right toolbar action to the canonical Home Search handler', () => {
    const onSearchPress = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(ModeToolbarHarness, {
          foregroundColor: '#000000',
          imageUri: null,
          name: 'Conta',
          onProfilePress: jest.fn(),
          onSearchPress,
        }),
      );
    });

    act(() => findNodes(renderer.root, 'toolbar-button')[0].props.onPress());

    expect(onSearchPress).toHaveBeenCalledTimes(1);
  });
});
