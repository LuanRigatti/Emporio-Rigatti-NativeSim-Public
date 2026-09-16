/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import NativeModeSheetContent from '@/components/native/NativeModeSheetContent/NativeModeSheetContent.ios';

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react') as typeof import('react');
  const nativeElement = (type: string) => {
    function NativeElement(props: Record<string, unknown>) {
      return React.createElement(type, props, props.children as never);
    }

    NativeElement.displayName = type;
    return NativeElement;
  };

  return {
    Button: nativeElement('swift-button'),
    HStack: nativeElement('swift-hstack'),
    Image: nativeElement('swift-image'),
    Spacer: nativeElement('swift-spacer'),
    Text: nativeElement('swift-text'),
    VStack: nativeElement('swift-vstack'),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier = () => ({});

  return {
    accessibilityLabel: modifier,
    buttonStyle: modifier,
    contentShape: modifier,
    font: modifier,
    foregroundStyle: modifier,
    frame: modifier,
    padding: modifier,
    shapes: { rectangle: modifier },
  };
});

jest.mock('@/theme', () => ({
  spacing: { xs: 8, sm: 12, md: 16 },
  useAppTheme: () => ({
    theme: { colors: { textPrimary: '#000000', textSecondary: '#666666' } },
  }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerNativeButtonHaptic: jest.fn(),
}));

function findNodes(instance: ReactTestInstance, type: string) {
  return instance.findAll((node) => String(node.type) === type);
}

function renderContent(
  mode: 'wholesale' | 'retail',
  onSelect: (mode: 'wholesale' | 'retail') => void,
) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(NativeModeSheetContent, { mode, onSelect }));
  });
  return renderer;
}

describe('NativeModeSheetContent', () => {
  it.each([
    ['wholesale', 0],
    ['retail', 1],
  ] as const)('renders the checkmark only for the selected mode: %s', (mode, selectedIndex) => {
    const renderer = renderContent(mode, jest.fn());
    const buttons = findNodes(renderer.root, 'swift-button');
    const checkmarks = findNodes(renderer.root, 'swift-image');

    expect(buttons).toHaveLength(2);
    expect(checkmarks).toHaveLength(1);
    expect(checkmarks[0].props.systemName).toBe('checkmark');
    expect(findNodes(buttons[selectedIndex], 'swift-image')).toHaveLength(1);
    expect(findNodes(buttons[1 - selectedIndex], 'swift-image')).toHaveLength(0);
  });

  it('calls the selected mode handler from the native option button', () => {
    const onSelect = jest.fn();
    const renderer = renderContent('wholesale', onSelect);
    const buttons = findNodes(renderer.root, 'swift-button');

    act(() => buttons[1].props.onPress());

    expect(onSelect).toHaveBeenCalledWith('retail');
  });
});
