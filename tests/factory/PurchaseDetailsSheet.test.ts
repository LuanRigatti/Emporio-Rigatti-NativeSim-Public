import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ComponentProps, type ReactNode } from 'react';

import type { Purchase } from '@/features/factory-purchases/types';

// Jest resolves the platform-specific .ios.tsx sibling for extensionless imports.
// This suite intentionally targets the fallback implementation directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PurchaseDetailsSheet } = require(
  '../../src/features/factory-purchases/components/PurchaseDetailsSheet.tsx',
) as {
  PurchaseDetailsSheet: typeof import('../../src/features/factory-purchases/components/PurchaseDetailsSheet').PurchaseDetailsSheet;
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

type MockNativeButtonProps = ComponentProps<typeof mockNativeButton>;

function mockNativeButton(props: { disabled?: boolean; onPress: () => void }) {
  return createElement('MockNativeButton', props);
}

function mockNativeDatePicker() {
  return createElement('MockNativeDatePicker');
}

function mockNativeSheet({ children }: { children?: ReactNode }) {
  return createElement('MockNativeSheet', null, children);
}

function mockNativeTextField(props: { onChangeText: (value: string) => void; value: string }) {
  return createElement('MockNativeTextField', props);
}

jest.mock('@/components/native', () => ({
  NativeButton: mockNativeButton,
  NativeDatePicker: mockNativeDatePicker,
  NativeSheet: mockNativeSheet,
  NativeTextField: mockNativeTextField,
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { danger: '#FF0000', textPrimary: '#000000', textSecondary: '#666666' },
      typography: { body: {}, footnote: {}, headline: {} },
    },
  }),
}));

function purchase(): Purchase {
  return {
    bucketQuantity: 10,
    bucketUnitPrice: 35,
    date: '2026-08-05',
    id: 'receipt-1',
    payments: [],
    totalAmount: 350,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function renderSheet(onAddPayment: MockNativeButtonProps['onPress']) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(PurchaseDetailsSheet, {
        onAddPayment: onAddPayment as never,
        onVisibleChange: jest.fn(),
        purchase: purchase(),
        visible: true,
      }),
    );
  });
  return renderer!;
}

function button(renderer: ReactTestRenderer) {
  return renderer.root.findByType(mockNativeButton);
}

function textField(renderer: ReactTestRenderer) {
  return renderer.root.findByType(mockNativeTextField);
}

describe('PurchaseDetailsSheet payment submission', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ignores a rapid second tap while the first payment is pending', async () => {
    const pending = deferred<void>();
    const onAddPayment = jest.fn(() => pending.promise);
    const renderer = renderSheet(onAddPayment);

    act(() => {
      textField(renderer).props.onChangeText('250');
    });
    const firstButton = button(renderer);

    await act(async () => {
      void firstButton.props.onPress();
      await Promise.resolve();
    });
    expect(button(renderer).props.disabled).toBe(true);

    await act(async () => {
      void firstButton.props.onPress();
      await Promise.resolve();
    });
    expect(onAddPayment).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(button(renderer).props.disabled).toBe(false);
    expect(textField(renderer).props.value).toBe('');
    act(() => {
      renderer.unmount();
    });
  });

  it('unlocks after a failed payment and preserves the typed value', async () => {
    const failed = deferred<void>();
    const onAddPayment = jest.fn(() => failed.promise);
    const renderer = renderSheet(onAddPayment);

    act(() => {
      textField(renderer).props.onChangeText('125');
    });
    const submit = button(renderer);
    await act(async () => {
      void submit.props.onPress();
      await Promise.resolve();
    });

    await act(async () => {
      failed.reject(new Error('Falha simulada'));
      await failed.promise.catch(() => undefined);
    });
    expect(button(renderer).props.disabled).toBe(false);
    expect(textField(renderer).props.value).toBe('125');
    act(() => {
      renderer.unmount();
    });
  });
});
