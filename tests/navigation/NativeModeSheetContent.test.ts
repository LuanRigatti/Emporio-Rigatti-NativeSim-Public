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
    Text: nativeElement('swift-text'),
    VStack: nativeElement('swift-vstack'),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier = () => ({});

  return {
    accessibilityLabel: modifier,
    accessibilityValue: modifier,
    background: modifier,
    buttonBorderShape: modifier,
    buttonStyle: modifier,
    font: modifier,
    foregroundStyle: modifier,
    frame: modifier,
    padding: modifier,
    offset: modifier,
    shapes: { capsule: modifier },
  };
});

jest.mock('@/theme', () => ({
  spacing: { xs: 8, sm: 12, md: 16 },
  useAppTheme: () => ({
    theme: {
      colors: {
        selectionContent: '#FFFFFF',
        selectionSurface: '#000000',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
    },
  }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
}));

const mockTriggerLightImpactHaptic = jest.requireMock('@/utils/haptics')
  .triggerLightImpactHaptic as jest.Mock;

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
  beforeEach(() => {
    mockTriggerLightImpactHaptic.mockClear();
  });

  it.each([
    ['wholesale', 0],
    ['retail', 1],
  ] as const)('renders two compact options with the selected mode: %s', (mode, selectedIndex) => {
    const renderer = renderContent(mode, jest.fn());
    const buttons = findNodes(renderer.root, 'swift-button');

    expect(buttons).toHaveLength(2);
    expect(findNodes(renderer.root, 'swift-text').map((node) => node.props.children)).toEqual([
      'Modo de venda',
      'Atacado',
      'Varejo',
    ]);
    expect(buttons[selectedIndex].props.modifiers).toBeDefined();
    expect(buttons[1 - selectedIndex].props.modifiers).toBeDefined();
    expect(buttons[selectedIndex].props.modifiers).toHaveLength(
      buttons[1 - selectedIndex].props.modifiers.length,
    );
  });

  it('calls the mode handler and emits haptic only for a real change', () => {
    const onSelect = jest.fn();
    const renderer = renderContent('wholesale', onSelect);
    const buttons = findNodes(renderer.root, 'swift-button');

    act(() => buttons[0].props.onPress());
    act(() => buttons[1].props.onPress());

    expect(onSelect.mock.calls).toEqual([['wholesale'], ['retail']]);
    expect(mockTriggerLightImpactHaptic).toHaveBeenCalledTimes(1);
  });
});
