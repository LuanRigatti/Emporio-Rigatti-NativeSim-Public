import { readFileSync } from 'node:fs';

/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import NativeAnimatedNumber from '@/components/native/NativeAnimatedNumber/NativeAnimatedNumber.native';

const financeRoute = readFileSync('src/app/(tabs)/financeiro/index.tsx', 'utf8');

jest.mock('@/platform/nativeCapabilities', () => ({
  getNativeCapabilities: () => ({ canUseExpoUI: true }),
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ text: (value: string) => value }),
}));

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react') as typeof import('react');
  const nativeElement = (type: string) => {
    function NativeElement(props: Record<string, unknown> & { children?: ReactNode }) {
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
    () =>
    (...args: unknown[]) => ({ args });

  return {
    animation: modifier(),
    contentTransition: modifier(),
    foregroundColor: modifier(),
    frame: modifier(),
    font: modifier(),
    monospacedDigit: modifier(),
    Animation: { easeInOut: () => ({}) },
  };
});

function renderNumber(props: { ignoreSafeArea?: 'all' } = {}) {
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
