/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

type HistoryEntry = {
  cliente: string;
  data: string;
  id: string;
  quantidadeBaldes: number;
  status: 'concluída' | 'pendente';
};

const mockUseDeliveries = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Toolbar = ({ children }: { children?: ReactNode }) =>
    React.createElement('history-toolbar', null, children);

  return { Stack: { Toolbar }, useFocusEffect: jest.fn() };
});

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'animated-view' },
  FadeIn: { duration: () => 'fade-in' },
  FadeInDown: { duration: () => 'fade-in-down' },
  LinearTransition: { duration: () => 'linear-transition' },
}));

jest.mock('@/components/layout', () => ({
  NativeGlassHeader: ({ rightActions, title }: { rightActions?: ReactNode; title: string }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('native-header', { title }, rightActions);
  },
}));

jest.mock('@/components/native', () => ({
  NativeRetailFinanceCategorySelector: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('history-segmented-control', props);
  },
  renderNativeDateToolbarItems: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('history-date-toolbar', props);
  },
}));

jest.mock('@/components/premium', () => ({
  GlassCard: ({ children }: { children?: ReactNode }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('glass-card', null, children);
  },
  ProgressiveCollapsibleScreen: ({
    children,
    largeTitle,
  }: {
    children?: ReactNode;
    largeTitle?: ReactNode;
  }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('progressive-screen', null, largeTitle, children);
  },
}));

jest.mock('@/features/history/components/DeliveryCard', () => ({
  DeliveryCard: ({ delivery }: { delivery: HistoryEntry }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('history-delivery-card', {
      deliveryId: delivery.id,
      quantity: delivery.quantidadeBaldes,
    });
  },
}));

jest.mock('@/features/history/components/EmptyState', () => ({
  EmptyState: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('history-empty-state');
  },
}));

jest.mock('@/features/history/components/HistoryCompactDeliveryCard', () => ({
  HistoryCompactDeliveryCard: ({ delivery }: { delivery: HistoryEntry }) => {
    const React = require('react') as typeof import('react');
    return React.createElement('history-compact-delivery-card', {
      deliveryId: delivery.id,
      quantity: delivery.quantidadeBaldes,
    });
  },
}));

jest.mock('@/hooks/useDeliveries', () => ({
  useDeliveries: (...args: unknown[]) => mockUseDeliveries(...args),
}));
jest.mock('@/providers', () => ({ useAppSafeAreaInsets: () => ({ bottom: 0, top: 0 }) }));
jest.mock('@/services/data', () => ({ toHistoryDelivery: (delivery: HistoryEntry) => delivery }));
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    reduceMotionEnabled: false,
    theme: {
      animations: { duration: { standard: 200 } },
      colors: {
        background: '#FFFFFF',
        success: '#008000',
        surface: '#FFFFFF',
        surfaceMuted: '#F3F3F3',
        textPrimary: '#111111',
        textSecondary: '#777777',
        warning: '#BB7700',
      },
      layout: { screenHorizontalPadding: 24, tabBarHeight: 80 },
      radius: { card: 20, xl: 24 },
      shadows: { card: {}, none: {} },
      sizes: { touchTargetMinimum: 44 },
      spacing: { lg: 20, md: 16, sm: 8, xl: 24, xs: 4, xxs: 2 },
      typography: {
        body: { lineHeight: 20 },
        callout: { lineHeight: 18 },
        caption: { lineHeight: 16 },
        footnote: { fontSize: 13, lineHeight: 15 },
        headline: { fontSize: 18, fontWeight: '600', lineHeight: 22 },
      },
    },
  }),
}));
jest.mock('@/utils/data', () => ({ todayIso: () => '2026-09-30' }));
jest.mock('@/utils/haptics', () => ({ triggerSelectionHaptic: jest.fn() }));
jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({
    enabled: false,
    quantity: (value: number, singular = 'balde', plural = 'baldes') =>
      `${value} ${value === 1 ? singular : plural}`,
  }),
}));

const { HistoryScreen } = require('@/features/history/components/HistoryScreen') as {
  HistoryScreen: () => ReactNode;
};

function delivery(id: string, data: string, quantidadeBaldes: number): HistoryEntry {
  return {
    cliente: id,
    data,
    id,
    quantidadeBaldes,
    status: 'concluída',
  };
}

function setDeliveries(deliveries: HistoryEntry[]) {
  mockUseDeliveries.mockReturnValue({
    deliveries,
    reload: jest.fn(),
    remove: jest.fn(),
    setDelivered: jest.fn(),
    toggleDelivered: jest.fn(),
  });
}

function renderScreen(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(HistoryScreen));
  });
  return renderer;
}

function summaryLabel(renderer: ReactTestRenderer): string | undefined {
  const header = renderer.root.find(
    (node) => String(node.type) === 'native-header' && node.props.title === 'Histórico',
  );
  return header.findAllByType(Text)[0]?.props.children;
}

function renderedBucketTotal(renderer: ReactTestRenderer): number {
  return renderer.root
    .findAll(
      (node) =>
        String(node.type) === 'history-delivery-card' ||
        String(node.type) === 'history-compact-delivery-card',
    )
    .reduce((total, card) => total + Number(card.props.quantity), 0);
}

describe('Wholesale History bucket total', () => {
  beforeEach(() => {
    setDeliveries([]);
  });

  it('uses the fixed Finance selector while preserving its dimensions and mode selection', () => {
    const renderer = renderScreen();
    let modeControl = renderer.root.find(
      (node) => String(node.type) === 'history-segmented-control',
    );

    expect(modeControl.props.style).toEqual({
      alignSelf: 'center',
      height: 63,
      width: '97%',
    });
    expect(modeControl.props.items).toEqual([
      { key: 'day', label: 'Dia' },
      { key: 'week', label: 'Semana' },
      { key: 'month', label: 'Mês' },
    ]);
    expect(modeControl.props.scrollable).toBe(false);
    expect(modeControl.props.selectionAnimationMode).toBe('slidingBubble');
    expect(modeControl.props.selectedKey).toBe('day');
    expect(modeControl.props.surfaceColor).toBeUndefined();
    expect(modeControl.props.selectedSurfaceColor).toBeUndefined();

    act(() => modeControl.props.onChange('week'));
    modeControl = renderer.root.find((node) => String(node.type) === 'history-segmented-control');
    expect(modeControl.props.selectedKey).toBe('week');

    act(() => modeControl.props.onChange('month'));
    modeControl = renderer.root.find((node) => String(node.type) === 'history-segmented-control');
    expect(modeControl.props.selectedKey).toBe('month');

    act(() => modeControl.props.onChange('day'));
    modeControl = renderer.root.find((node) => String(node.type) === 'history-segmented-control');
    expect(modeControl.props.selectedKey).toBe('day');

    act(() => renderer.unmount());
  });

  it('tracks the exact day, week, month and toolbar-selected period shown by History', () => {
    setDeliveries([
      delivery('day-five', '2026-09-30', 5),
      delivery('day-nine', '2026-09-30', 9),
      delivery('monday-three', '2026-09-28', 3),
      delivery('october-one', '2026-10-01', 7),
      delivery('september-fifteen', '2026-09-15', 2),
      delivery('sunday-four', '2026-10-04', 4),
      delivery('next-week-hundred', '2026-10-05', 100),
    ]);

    const renderer = renderScreen();
    expect(mockUseDeliveries).toHaveBeenCalledWith({ mode: 'all' }, { scope: 'historical' });
    expect(summaryLabel(renderer)).toBe('14 baldes');
    expect(renderedBucketTotal(renderer)).toBe(14);

    const modeControl = renderer.root.find(
      (node) => String(node.type) === 'history-segmented-control',
    );
    act(() => modeControl.props.onChange('week'));
    expect(summaryLabel(renderer)).toBe('28 baldes');
    expect(renderedBucketTotal(renderer)).toBe(28);

    act(() => modeControl.props.onChange('month'));
    expect(summaryLabel(renderer)).toBe('19 baldes');
    expect(renderedBucketTotal(renderer)).toBe(19);

    const dateToolbar = renderer.root.find((node) => String(node.type) === 'history-date-toolbar');
    act(() => dateToolbar.props.onDateChange('2026-10-01'));
    expect(summaryLabel(renderer)).toBe('111 baldes');
    expect(renderedBucketTotal(renderer)).toBe(111);

    act(() => modeControl.props.onChange('day'));
    expect(summaryLabel(renderer)).toBe('7 baldes');
    expect(renderedBucketTotal(renderer)).toBe(7);

    act(() => modeControl.props.onChange('week'));
    const updatedDateToolbar = renderer.root.find(
      (node) => String(node.type) === 'history-date-toolbar',
    );
    act(() => updatedDateToolbar.props.onWeekChange('2026-10-05'));
    expect(summaryLabel(renderer)).toBe('100 baldes');
    expect(renderedBucketTotal(renderer)).toBe(100);

    act(() => renderer.unmount());
  });

  it('formats zero, singular and plural totals and follows reactive delivery changes', () => {
    const renderer = renderScreen();
    expect(summaryLabel(renderer)).toBe('0 baldes');

    setDeliveries([delivery('created', '2026-09-30', 1)]);
    act(() => renderer.update(createElement(HistoryScreen)));
    expect(summaryLabel(renderer)).toBe('1 balde');
    expect(renderedBucketTotal(renderer)).toBe(1);

    setDeliveries([delivery('created', '2026-09-30', 1), delivery('another', '2026-09-30', 13)]);
    act(() => renderer.update(createElement(HistoryScreen)));
    expect(summaryLabel(renderer)).toBe('14 baldes');
    expect(renderedBucketTotal(renderer)).toBe(14);

    setDeliveries([delivery('created', '2026-09-30', 1)]);
    act(() => renderer.update(createElement(HistoryScreen)));
    expect(summaryLabel(renderer)).toBe('1 balde');
    expect(renderedBucketTotal(renderer)).toBe(1);

    act(() => renderer.unmount());
  });
});
