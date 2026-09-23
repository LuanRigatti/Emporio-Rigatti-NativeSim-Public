/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import NativeSheetExpo from '@/components/native/NativeSheet/NativeSheet.expo';
import NativeSheetSwiftUI from '@/components/native/NativeSheet/NativeSheetSwiftUI.ios';
import { NATIVE_SHEET_TRANSPARENT_BACKGROUND } from '@/components/native/nativeSheetBackground';
import type { NativeSheetProps } from '@/types/native-ui';

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
    BottomSheet: nativeElement('swift-bottom-sheet'),
    Group: nativeElement('swift-group'),
    Host: nativeElement('swift-host'),
    Spacer: nativeElement('swift-spacer'),
    ZStack: nativeElement('swift-zstack'),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ name, args });

  return {
    frame: modifier('frame'),
    glassEffect: modifier('glassEffect'),
    presentationBackground: modifier('presentationBackground'),
    presentationBackgroundInteraction: modifier('presentationBackgroundInteraction'),
    presentationDetents: modifier('presentationDetents'),
    presentationDragIndicator: modifier('presentationDragIndicator'),
  };
});

jest.mock('@/theme', () => ({
  useAppTheme: () => ({ resolvedMode: 'dark', theme: { radius: { card: 16 } } }),
}));

jest.mock('@/components/premium', () => ({
  BottomSheet: (() => {
    const React = require('react') as typeof import('react');
    function MockBottomSheet(props: Record<string, unknown> & { children?: ReactNode }) {
      return React.createElement('premium-bottom-sheet', props, props.children);
    }

    MockBottomSheet.displayName = 'MockBottomSheet';
    return MockBottomSheet;
  })(),
}));

function findNodes(instance: ReactTestInstance, type: string) {
  return instance.findAll((node) => String(node.type) === type);
}

describe('NativeSheet dismissal contract', () => {
  it('forwards the native SwiftUI onDismiss callback', () => {
    const onDismiss = jest.fn();
    const onVisibleChange = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(
          NativeSheetSwiftUI,
          { onDismiss, onVisibleChange, visible: true } as unknown as NativeSheetProps,
          createElement('content'),
        ),
      );
    });

    const sheet = findNodes(renderer.root, 'swift-bottom-sheet')[0];

    expect(sheet.props.onDismiss).toBe(onDismiss);
    expect(sheet.props.onIsPresentedChange).toBe(onVisibleChange);

    act(() => sheet.props.onIsPresentedChange(false));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => sheet.props.onDismiss());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('completes the synchronous fallback close with onDismiss', () => {
    const onDismiss = jest.fn();
    const onVisibleChange = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(
          NativeSheetExpo,
          { onDismiss, onVisibleChange, visible: true } as unknown as NativeSheetProps,
          createElement('content'),
        ),
      );
    });

    const sheet = findNodes(renderer.root, 'premium-bottom-sheet')[0];

    act(() => sheet.props.onClose());

    expect(onVisibleChange).toHaveBeenCalledWith(false);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies an opt-in tinted glass surface without changing the sheet contract', () => {
    const tint = 'shared-dark-liquid-glass-tint';
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(
          NativeSheetSwiftUI,
          {
            glassSurface: true,
            glassTint: tint,
            onVisibleChange: jest.fn(),
            visible: true,
          } as unknown as NativeSheetProps,
          createElement('content'),
        ),
      );
    });

    const host = findNodes(renderer.root, 'swift-host')[0];
    const group = findNodes(renderer.root, 'swift-group')[0];
    const glassLayers = findNodes(renderer.root, 'swift-zstack');
    const glassLayer = glassLayers[1];

    expect(host.props.matchContents).toBe(false);
    expect(host.props.useViewportSizeMeasurement).toBe(true);
    expect(host.props.style).toEqual(expect.objectContaining({ position: 'absolute' }));
    expect(glassLayers).toHaveLength(2);
    expect(glassLayer.props.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'frame',
          args: [{ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }],
        }),
      ]),
    );
    expect(group.props.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'presentationBackground',
          args: [NATIVE_SHEET_TRANSPARENT_BACKGROUND],
        }),
      ]),
    );
    expect(glassLayer.props.modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'glassEffect',
          args: [
            expect.objectContaining({
              glass: expect.objectContaining({
                interactive: true,
                tint,
                variant: 'regular',
              }),
            }),
          ],
        }),
      ]),
    );
    expect(
      glassLayers
        .flatMap((layer) => layer.props.modifiers ?? [])
        .filter((modifier: { name?: string }) => modifier.name === 'glassEffect'),
    ).toHaveLength(1);
  });
});
