/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import NativeModeSheetContent from '@/components/native/NativeModeSheetContent/NativeModeSheetContent.ios';
const NativeModeSheetContentFallback =
  require('@/components/native/NativeModeSheetContent/NativeModeSheetContent.tsx')
    .default as typeof NativeModeSheetContent;

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
    Circle: nativeElement('swift-circle'),
    Divider: nativeElement('swift-divider'),
    HStack: nativeElement('swift-hstack'),
    Image: nativeElement('swift-image'),
    Spacer: nativeElement('swift-spacer'),
    Text: nativeElement('swift-text'),
    VStack: nativeElement('swift-vstack'),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ name, args });

  return {
    accessibilityLabel: modifier('accessibilityLabel'),
    accessibilityValue: modifier('accessibilityValue'),
    background: modifier('background'),
    buttonStyle: modifier('buttonStyle'),
    contentShape: modifier('contentShape'),
    font: modifier('font'),
    foregroundStyle: modifier('foregroundStyle'),
    frame: modifier('frame'),
    padding: modifier('padding'),
    offset: modifier('offset'),
    shapes: {
      rectangle: modifier('rectangle'),
      roundedRectangle: modifier('roundedRectangle'),
    },
  };
});

jest.mock('@/theme', () => ({
  fonts: { weight: { regular: '400' } },
  spacing: { xs: 8, sm: 12, md: 16 },
  useAppTheme: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react') as typeof import('react');

  return {
    Ionicons: (props: Record<string, unknown>) => React.createElement('ion-icon', props),
  };
});

jest.mock('@/utils/haptics', () => ({
  triggerLightImpactHaptic: jest.fn(),
}));

const mockTriggerLightImpactHaptic = jest.requireMock('@/utils/haptics')
  .triggerLightImpactHaptic as jest.Mock;
const mockUseAppTheme = jest.requireMock('@/theme').useAppTheme as jest.Mock;

function createTheme(success: string, contrastSurface = '#000000') {
  return {
    theme: {
      colors: {
        contrastSurface,
        selectionContent: '#FFFFFF',
        selectionSurface: '#000000',
        separator: '#E5E7EB',
        success,
        surfaceElevated: '#FFFFFF',
        textPrimary: '#000000',
        textSecondary: '#666666',
      },
      radius: { xl: 22 },
      typography: { title2: {}, title3: {} },
    },
  };
}

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

function renderFallbackContent(mode: 'wholesale' | 'retail') {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(NativeModeSheetContentFallback, { mode, onSelect: jest.fn() }));
  });
  return renderer;
}

describe('NativeModeSheetContent', () => {
  beforeEach(() => {
    mockTriggerLightImpactHaptic.mockClear();
    mockUseAppTheme.mockReturnValue(createTheme('#117A52'));
  });

  it.each([
    ['wholesale', 0, ['shippingbox.fill', 'bag'], ['#000000', '#666666']],
    ['retail', 1, ['shippingbox', 'bag.fill'], ['#666666', '#000000']],
  ] as const)(
    'renders stacked mode rows with the selected icon: %s',
    (mode, selectedIndex, expectedSymbols, expectedColors) => {
      const renderer = renderContent(mode, jest.fn());
      const buttons = findNodes(renderer.root, 'swift-button');
      const images = findNodes(renderer.root, 'swift-image');
      const verticalStacks = findNodes(renderer.root, 'swift-vstack');
      const card = verticalStacks[1];

      expect(buttons).toHaveLength(2);
      expect(findNodes(renderer.root, 'swift-divider')).toHaveLength(1);
      expect(verticalStacks).toHaveLength(2);
      expect(findNodes(card, 'swift-button')).toHaveLength(2);
      expect(findNodes(renderer.root, 'swift-text').map((node) => node.props.children)).toEqual([
        'Modo de venda',
        'Atacado',
        'Varejo',
      ]);
      expect(images.map((image) => image.props.systemName)).toEqual(expectedSymbols);
      expect(images.map((image) => image.props.color)).toEqual(expectedColors);
      expect(findNodes(renderer.root, 'swift-circle')).toHaveLength(0);
      const selectedRowStacks = findNodes(buttons[selectedIndex], 'swift-hstack');
      expect(selectedRowStacks).toHaveLength(1);
      expect(
        selectedRowStacks[0].children.map((child) =>
          typeof child === 'string'
            ? child
            : ((child.type as unknown as { displayName?: string }).displayName ??
              String(child.type)),
        ),
      ).toEqual(['swift-image', 'swift-text', 'swift-spacer']);
      expect(card.props.modifiers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'background',
            args: [
              '#FFFFFF',
              {
                name: 'roundedRectangle',
                args: [{ cornerRadius: 22, roundedCornerStyle: 'continuous' }],
              },
            ],
          }),
        ]),
      );
      buttons.forEach((button) => {
        expect(button.props.modifiers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'frame',
              args: [{ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }],
            }),
            expect.objectContaining({ name: 'contentShape' }),
          ]),
        );
      });
      expect(
        buttons.map(
          (button) =>
            (button.props.modifiers as { name: string; args: unknown[] }[]).find(
              (modifier) => modifier.name === 'accessibilityValue',
            )?.args[0],
        ),
      ).toEqual(
        selectedIndex === 0
          ? ['Selecionado', 'Não selecionado']
          : ['Não selecionado', 'Selecionado'],
      );
    },
  );

  it.each([
    ['wholesale', '#117A52', '#000000', ['shippingbox.fill', 'bag'], [true, false]],
    ['wholesale', '#30D158', '#FFFFFF', ['shippingbox.fill', 'bag'], [true, false]],
    ['retail', '#117A52', '#000000', ['shippingbox', 'bag.fill'], [false, true]],
    ['retail', '#30D158', '#FFFFFF', ['shippingbox', 'bag.fill'], [false, true]],
  ] as const)(
    'uses the contrast surface only for the active icon in %s',
    (mode, successColor, contrastSurface, expectedSymbols, activeStates) => {
      mockUseAppTheme.mockReturnValue(createTheme(successColor, contrastSurface));

      const renderer = renderContent(mode, jest.fn());
      const images = findNodes(renderer.root, 'swift-image');

      expect(images.map((image) => image.props.systemName)).toEqual(expectedSymbols);
      expect(images.map((image) => image.props.color)).toEqual(
        activeStates.map((active) => (active ? contrastSurface : '#666666')),
      );
    },
  );

  it.each([
    ['wholesale', 0, '#117A52', '#000000'],
    ['wholesale', 0, '#30D158', '#FFFFFF'],
    ['retail', 1, '#117A52', '#000000'],
    ['retail', 1, '#30D158', '#FFFFFF'],
  ] as const)(
    'uses the filled fallback icon only for the active mode and removes its dot: %s',
    (mode, selectedIndex, successColor, contrastSurface) => {
      mockUseAppTheme.mockReturnValue(createTheme(successColor, contrastSurface));
      const renderer = renderFallbackContent(mode);
      const rows = renderer.root.findAll(
        (node) =>
          node.props.accessibilityRole === 'button' &&
          node.props.accessibilityLabel &&
          typeof node.type === 'function' &&
          node.type.name === 'Pressable',
      );
      const rowIcons = rows.map((row) => findNodes(row, 'ion-icon'));
      expect(rows).toHaveLength(2);
      const icons = rowIcons.map((row) => row[0]);
      expect(icons.map((icon) => icon.props.name)).toEqual(
        selectedIndex === 0 ? ['cube', 'bag-outline'] : ['cube-outline', 'bag'],
      );
      expect(icons.map((icon) => icon.props.color)).toEqual(
        selectedIndex === 0 ? [contrastSurface, '#666666'] : ['#666666', contrastSurface],
      );
      expect(
        renderer.root.findAll(
          (node) => node.props.accessible === false && node.props.pointerEvents === 'none',
        ),
      ).toHaveLength(0);
    },
  );

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
