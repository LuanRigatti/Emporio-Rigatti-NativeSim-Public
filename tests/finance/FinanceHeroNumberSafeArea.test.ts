import { readFileSync } from 'node:fs';

/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import NativeAnimatedNumber from '@/components/native/NativeAnimatedNumber/NativeAnimatedNumber.native';
import type { NativeAnimatedNumberProps } from '@/components/native/NativeAnimatedNumber/NativeAnimatedNumber.types';

const financeRoute = readFileSync('src/app/(tabs)/financeiro/index.tsx', 'utf8');
type SwiftModifier = { name: string; args: unknown[] };
const mockSwiftTextCommits: (SwiftModifier[] | undefined)[] = [];

jest.mock('@/platform/nativeCapabilities', () => ({
  getNativeCapabilities: () => ({ canUseExpoUI: true }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ text: (value: string) => value }),
}));

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react') as typeof import('react');
  const nativeElement = (type: string) => {
    function NativeElement(
      props: Record<string, unknown> & { children?: ReactNode; modifiers?: SwiftModifier[] },
    ) {
      React.useLayoutEffect(() => {
        if (type === 'swift-text') mockSwiftTextCommits.push(props.modifiers);
      }, [props.modifiers]);
      return React.createElement(type, props, props.children);
    }

    NativeElement.displayName = type;
    return NativeElement;
  };

  return {
    Host: nativeElement('swift-host'),
    Text: nativeElement('swift-text'),
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ name, args });

  return {
    animation: modifier('animation'),
    contentTransition: modifier('contentTransition'),
    foregroundColor: modifier('foregroundColor'),
    frame: modifier('frame'),
    font: modifier('font'),
    monospacedDigit: modifier('monospacedDigit'),
    Animation: { easeInOut: (config: { duration: number }) => config },
  };
});

function renderNumber(props: Partial<NativeAnimatedNumberProps> = {}) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(
      createElement(NativeAnimatedNumber, {
        animationEnabled: false,
        color: '#000000',
        text: 'R$ 1.234,56',
        value: 1234.56,
        ...props,
      }),
    );
  });

  return renderer;
}

function host(renderer: ReactTestRenderer): ReactTestInstance {
  return renderer.root.find((node) => String(node.type) === 'swift-host');
}

function financeCardNumberFor(label: RegExp) {
  const cards = [...financeRoute.matchAll(/<PremiumCard\b[\s\S]*?<\/PremiumCard>/g)].map(
    ([card]) => card,
  );
  const card = cards.find((candidate) => label.test(candidate));

  if (!card) {
    throw new Error(`Could not find finance card for "${label.source}".`);
  }

  const numberTag = card.match(/<NativeAnimatedNumber\b[\s\S]*?\/>/)?.[0];

  if (!numberTag) {
    throw new Error(`Could not find NativeAnimatedNumber in the "${label}" card.`);
  }

  return numberTag;
}

describe('Finance hero number safe area', () => {
  it('forwards the opt-in to the SwiftUI Host without changing matchContents', () => {
    const renderer = renderNumber({ ignoreSafeArea: 'all' });
    const renderedHost = host(renderer);

    expect(renderedHost.props.ignoreSafeArea).toBe('all');
    expect(renderedHost.props.matchContents).toBe(false);
  });

  it('keeps the shared NativeAnimatedNumber Host unchanged by default', () => {
    const renderer = renderNumber();
    const renderedHost = host(renderer);

    expect(renderedHost.props.ignoreSafeArea).toBeUndefined();
    expect(renderedHost.props.matchContents).toBe(false);
  });

  it('opts in only the Faturamento and Lucro Líquido cards on the finance route', () => {
    const numberTags = [...financeRoute.matchAll(/<NativeAnimatedNumber\b[\s\S]*?\/>/g)].map(
      ([tag]) => tag,
    );

    expect(financeCardNumberFor(/FATURAMENTO\s*<\/Text>/)).toContain('ignoreSafeArea="all"');
    expect(financeCardNumberFor(/LUCRO LÍQUIDO\s*<\/Text>/)).toContain('ignoreSafeArea="all"');
    expect(financeCardNumberFor(/RECEBIDO\s*<\/Text>/)).not.toContain('ignoreSafeArea');
    expect(financeCardNumberFor(/LUCRO DIRETO\s*<\/Text>/)).not.toContain('ignoreSafeArea');
    expect(numberTags.filter((tag) => tag.includes('ignoreSafeArea="all"'))).toHaveLength(2);
  });
});

describe('Finance hero SwiftUI number transition', () => {
  it('arms numericText at the first confirmed value and updates its animation value on the same Text', () => {
    const color = '#000000';
    const renderer = renderNumber({ color, text: 'Aguardando confirmação', value: null });
    const getText = () => renderer.root.find((node) => String(node.type) === 'swift-text');
    const swiftText = getText();
    const updateNumber = (value: number, text: string) => {
      mockSwiftTextCommits.length = 0;
      act(() => renderer.update(createElement(NativeAnimatedNumber, { color, text, value })));
      expect(getText()).toBe(swiftText);
      expect(getText().props.children).toBe(text);
      return mockSwiftTextCommits.map(
        (modifiers) => modifiers?.find(({ name }) => name === 'animation')?.args[1],
      );
    };

    expect(updateNumber(50, 'R$ 50,00')).toEqual([undefined, 50]);
    expect(updateNumber(75, 'R$ 75,00')).toEqual([75]);
    expect(getText().props.modifiers).toContainEqual({
      name: 'contentTransition',
      args: ['numericText'],
    });
  });

  it('prepares the opted-in Text for entry and a later numeric update, including a real zero', () => {
    const color = '#000000';
    const renderer = renderNumber({
      animateFirstValue: true,
      color,
      text: 'Aguardando confirmação',
      value: null,
    });
    const getText = () => renderer.root.find((node) => String(node.type) === 'swift-text');
    const swiftText = getText();
    const getAnimationArgs = () =>
      (swiftText.props.modifiers as SwiftModifier[])
        .filter(({ name }) => name === 'animation')
        .map(({ args }) => args);
    const updateNumber = (value: number | null, text: string) => {
      act(() =>
        renderer.update(
          createElement(NativeAnimatedNumber, {
            animateFirstValue: true,
            animationEnabled: value !== null,
            color,
            text,
            value,
          }),
        ),
      );
      expect(getText()).toBe(swiftText);
      expect(swiftText.props.children).toBe(text);
      expect(swiftText.props.modifiers).toContainEqual({
        name: 'contentTransition',
        args: ['numericText'],
      });
    };

    expect(swiftText.props.children).toBe('Aguardando confirmação');
    expect(getAnimationArgs()).toEqual([
      [{ duration: 0 }, false],
      [{ duration: 0 }, 0],
    ]);

    updateNumber(0, 'R$ 0,00');
    expect(getAnimationArgs()).toEqual([
      [{ duration: 0.18 }, true],
      [{ duration: 0.18 }, 0],
    ]);

    updateNumber(75, 'R$ 75,00');
    expect(getAnimationArgs()).toEqual([
      [{ duration: 0.18 }, true],
      [{ duration: 0.18 }, 75],
    ]);

    updateNumber(null, 'Lucro líquido indisponível');
    expect(getAnimationArgs()).toEqual([
      [{ duration: 0 }, false],
      [{ duration: 0 }, 0],
    ]);
  });
});
