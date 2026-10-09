/* eslint-disable @typescript-eslint/no-require-imports */

import { createElement, type ComponentType, type ReactNode } from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { Delivery } from '@/types/data';

jest.mock('@/components/layout/MeasuredContextMenuGeometry', () => ({
  MeasuredContextMenuGeometry: ({ children }: { children: (value: unknown) => unknown }) =>
    children({
      onLayout: jest.fn(),
      previewFrameStyle: { height: 72, width: 300 },
      triggerWidthStyle: { width: 300 },
    }),
}));

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');

  return {
    NativeCardContextMenu: ({
      actions,
      children,
      preview,
    }: {
      actions: unknown[];
      children: ReactNode;
      preview: ReactNode;
    }) =>
      React.createElement(
        'native-card-context-menu',
        { actions },
        React.createElement('native-context-preview', null, preview),
        React.createElement('native-context-trigger', null, children),
      ),
  };
});

jest.mock('@/components/premium', () => {
  const React = require('react') as typeof import('react');

  return {
    GlassCard: ({ children }: { children?: ReactNode }) =>
      React.createElement('glass-card', null, children),
  };
});

jest.mock('@/providers', () => ({
  useAppSafeAreaInsets: () => ({ bottom: 0, left: 8, right: 8, top: 0 }),
}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: () => '#FEFFFF',
  useAppTheme: () => ({
    resolvedMode: 'light',
    theme: {
      colors: {
        background: '#F8F7F5',
        surface: '#FEFFFF',
        textPrimary: '#171923',
        textSecondary: '#656A73',
      },
      radius: { xl: 24 },
      spacing: { md: 16, sm: 12, xs: 8, xxs: 4 },
      typography: { body: {}, caption: {}, footnote: {}, headline: {} },
    },
  }),
}));

jest.mock('@/utils/groupItemsByDate', () => ({
  formatDateAsDayMonthYear: (value: string) => `date:${value}`,
}));

jest.mock('@/utils/presentation/testModeValues', () => ({
  useTestModePresentation: () => ({ currency: (value: number) => `R$ ${value.toFixed(2)}` }),
}));

jest.mock('../../src/features/open-payments/components/OpenPaymentClientIcon', () => {
  const React = require('react') as typeof import('react');

  return { __esModule: true, default: () => React.createElement('open-payment-client-icon') };
});

const { OpenPaymentClientCards } =
  require('../../src/features/open-payments/components/OpenPaymentClientCards') as {
    OpenPaymentClientCards: ComponentType<Record<string, unknown>>;
  };

function makeDelivery(
  id: string,
  status: Delivery['status'],
  date: string,
  clientId: Delivery['clientId'] = 'client:andre',
): Delivery {
  return {
    clientId,
    cliente: 'André Marques',
    data: date,
    entregue: true,
    id,
    metodoPagamento: 'Pix',
    quantidade: 1,
    status,
    valor: 50,
  };
}

function renderCards(recentPayments: Delivery[], onMarkAsPaid = jest.fn()): ReactTestRenderer {
  let renderer!: ReactTestRenderer;

  Dimensions.set({
    screen: { fontScale: 1, height: 844, scale: 3, width: 390 },
    window: { fontScale: 1, height: 844, scale: 3, width: 390 },
  });

  act(() => {
    renderer = create(
      createElement(OpenPaymentClientCards, {
        clients: [
          {
            deliveries: [makeDelivery('open-1', 'Não Pago', '2026-10-07')],
            entregas: 1,
            nome: 'André Marques',
            percentual: 100,
            quantidade: 1,
            recentPayments,
            valor: 120,
          },
        ],
        onMarkAsPaid,
        paymentHistoryLoading: false,
        testModeEnabled: false,
      }),
    );
  });

  return renderer;
}

describe('OpenPaymentClientCards rich context preview', () => {
  it('keeps the trigger geometry, preserves Pago, and gives only the preview viewport width and natural height', () => {
    const renderer = renderCards([
      makeDelivery('paid-1', 'Pago', '2026-10-06'),
      makeDelivery('paid-2', 'Pago', '2026-10-03'),
      makeDelivery('paid-3', 'Pago', '2026-09-28'),
    ]);
    const menu = renderer.root.findAll(
      (node) => String(node.type) === 'native-card-context-menu',
    )[0];
    const trigger = renderer.root.findByProps({ testID: 'open-payment-client-trigger' });
    const preview = renderer.root.findByProps({ testID: 'open-payment-rich-preview' });
    const triggerWidth = StyleSheet.flatten(trigger.props.style).width;
    const previewStyle = StyleSheet.flatten(preview.props.style);

    expect(menu.props.actions.map((action: { title: string }) => action.title)).toEqual(['Pago']);
    expect(triggerWidth).toBe(300);
    expect(previewStyle.width).toBeGreaterThan(triggerWidth);
    expect(previewStyle.height).toBeUndefined();

    const text = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(
      text.filter((value) => typeof value === 'string' && value.startsWith('date:')),
    ).toHaveLength(3);
    expect(text).toContain('Últimos pagamentos');
    expect(text).toContain('date:2026-10-06');
    expect(text).toContain('R$ 120.00');
    expect(text).toContain('Pix');
    act(() => renderer.unmount());
  });

  it('shows the empty state when no payment records exist', () => {
    const renderer = renderCards([]);
    const text = renderer.root.findAllByType(Text).map((node) => node.props.children);

    expect(text).toContain('Sem pagamentos anteriores');
    act(() => renderer.unmount());
  });

  it('forwards the existing Pago action to the delivery mutation callback', () => {
    const onMarkAsPaid = jest.fn();
    const renderer = renderCards([], onMarkAsPaid);
    const menu = renderer.root.findAll(
      (node) => String(node.type) === 'native-card-context-menu',
    )[0];

    act(() => menu.props.actions[0].onPress());

    expect(onMarkAsPaid).toHaveBeenCalledWith('open-1');
    act(() => renderer.unmount());
  });
});
