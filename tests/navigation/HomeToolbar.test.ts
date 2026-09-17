/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { HomeToolbar } from '@/components/navigation/HomeToolbar';

const mockSetMode = jest.fn();
const mockAppMode = {
  mode: 'wholesale' as 'wholesale' | 'retail',
  isReady: true,
  setMode: mockSetMode,
};
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

  const Toolbar = Object.assign(MockToolbar, {
    View: MockToolbarView,
    Button: MockToolbarButton,
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

function renderToolbar(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(HomeToolbar, {
        foregroundColor: '#000000',
        imageUri: null,
        name: 'Conta',
        onProfilePress: jest.fn(),
        onSearchPress: jest.fn(),
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

  it('opens the NativeSheet from the fixed toolbar button', () => {
    const renderer = renderToolbar();
    const button = findNodes(renderer.root, 'toolbar-button')[0];

    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);

    act(() => button.props.onPress());

    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(true);
  });

  it('selects a different mode and closes the NativeSheet', () => {
    const renderer = renderToolbar();
    const button = findNodes(renderer.root, 'toolbar-button')[0];

    act(() => button.props.onPress());
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];

    act(() => modeSheetContent.props.onSelect('retail'));

    expect(mockSetMode.mock.calls).toEqual([['retail']]);
    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);
  });

  it('closes without writing when the current mode is selected again', () => {
    const renderer = renderToolbar();
    const button = findNodes(renderer.root, 'toolbar-button')[0];

    act(() => button.props.onPress());
    const modeSheetContent = findNodes(renderer.root, 'native-mode-sheet-content')[0];

    act(() => modeSheetContent.props.onSelect('wholesale'));

    expect(mockSetMode).not.toHaveBeenCalled();
    expect(findNodes(renderer.root, 'native-sheet')[0].props.visible).toBe(false);
  });

  it('keeps Home actions as an independent toolbar sibling', () => {
    const renderer = renderToolbar();
    const modeButtons = findNodes(renderer.root, 'toolbar-button');
    const toolbarViews = findNodes(renderer.root, 'toolbar-view');

    expect(modeButtons).toHaveLength(1);
    expect(toolbarViews).toHaveLength(1);
    expect(findNodes(modeButtons[0], 'native-home-toolbar-actions')).toHaveLength(0);
    expect(findNodes(toolbarViews[0], 'native-home-toolbar-actions')).toHaveLength(1);
  });

  it('renders Home actions on the left and the fixed mode button on the right', () => {
    const renderer = renderToolbar();
    const toolbars = findNodes(renderer.root, 'toolbar');

    expect(toolbars).toHaveLength(2);
    const leftToolbar = toolbars.find((toolbar) => toolbar.props.placement === 'left');
    const rightToolbar = toolbars.find((toolbar) => toolbar.props.placement === 'right');

    expect(leftToolbar?.props.directChildTypes).toEqual(['MockToolbarView']);
    expect(rightToolbar?.props.directChildTypes).toEqual(['MockToolbarButton']);
    expect(findNodes(rightToolbar!, 'toolbar-button')[0].props.children).toBe('Modo');
    expect(findNodes(leftToolbar!, 'native-home-toolbar-actions')).toHaveLength(1);
  });

  it('keeps the toolbar button structure stable when the mode changes', () => {
    const renderer = renderToolbar();
    const initialMounts = mockToolbarMounts;
    const initialUnmounts = mockToolbarUnmounts;
    const initialButton = findNodes(renderer.root, 'toolbar-button')[0];

    mockAppMode.mode = 'retail';
    act(() =>
      renderer.update(
        createElement(HomeToolbar, {
          foregroundColor: '#000000',
          imageUri: null,
          name: 'Conta',
          onProfilePress: jest.fn(),
          onSearchPress: jest.fn(),
        }),
      ),
    );

    const nextButton = findNodes(renderer.root, 'toolbar-button')[0];
    expect(nextButton.props.children).toBe(initialButton.props.children);
    expect(mockToolbarMounts).toBe(initialMounts);
    expect(mockToolbarUnmounts).toBe(initialUnmounts);
  });
});
