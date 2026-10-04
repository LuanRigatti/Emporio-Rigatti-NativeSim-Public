/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, Fragment } from 'react';
import { Text } from 'react-native';

import type { Purchase } from '@/features/factory-purchases/types';

const mockSourceListeners = new Set<() => void>();
const mockSourceSubscribe = jest.fn((listener: () => void) => {
  mockSourceListeners.add(listener);
  return () => mockSourceListeners.delete(listener);
});
let mockReceipts: Purchase[] = [];

jest.mock('@/providers', () => ({
  useAuth: () => ({ sessionVersion: 1, user: { id: 'user-1' } }),
}));

jest.mock('@/services/finance', () => ({
  factoryReceiptQueryService: { filter: jest.fn((receipts: Purchase[]) => receipts) },
}));

jest.mock('@/services/factory-purchases', () => ({
  factoryReceiptDataSource: {
    getReceipts: () => mockReceipts,
    subscribe: (listener: () => void) => mockSourceSubscribe(listener),
  },
  factoryReceiptToPurchase: (receipt: Purchase) => receipt,
  factoryReceiptsToPurchases: (receipts: Purchase[]) => receipts,
}));

const { useFactoryPurchaseById } = require('../../src/hooks/useFactoryPurchases') as {
  useFactoryPurchaseById: (purchaseId?: string) => Purchase | null;
};

function PurchaseReader({ purchaseId }: { purchaseId: string }) {
  const purchase = useFactoryPurchaseById(purchaseId);
  return createElement(Text, null, String(purchase?.payments.length ?? 'missing'));
}

function renderReaders(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(
        Fragment,
        null,
        createElement(PurchaseReader, { purchaseId: 'receipt-1' }),
        createElement(PurchaseReader, { purchaseId: 'receipt-1' }),
      ),
    );
  });
  return renderer;
}

describe('useFactoryPurchaseById', () => {
  beforeEach(() => {
    mockSourceSubscribe.mockClear();
    mockSourceListeners.clear();
    mockReceipts = [
      {
        bucketQuantity: 10,
        bucketUnitPrice: 35,
        date: '2026-08-05',
        id: 'receipt-1',
        payments: [],
        totalAmount: 350,
      },
    ];
  });

  it('shares one source subscription and reflects published payment updates', () => {
    const renderer = renderReaders();

    expect(mockSourceSubscribe).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '0',
      '0',
    ]);

    mockReceipts = [
      {
        ...mockReceipts[0],
        payments: [{ amount: 100, date: '2026-08-07', id: 'payment-1' }],
      },
    ];
    act(() => {
      mockSourceListeners.forEach((listener) => listener());
    });

    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      '1',
      '1',
    ]);
    act(() => renderer.unmount());
    expect(mockSourceListeners.size).toBe(0);
  });
});
