import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { RetailOrderPaymentSheet } from '@/features/retail-orders/components/RetailOrderPaymentSheet';
import { formatCurrency, parseIsoCalendarDate } from '@/utils/data';

const mockCreateElement = (...args: Parameters<typeof createElement>) => createElement(...args);

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/components/native', () => ({
  NativeButton: (props: Record<string, unknown>) =>
    mockCreateElement('native-button', props, props.label as ReactNode),
  NativeDatePicker: (props: Record<string, unknown>) =>
    mockCreateElement('native-date-picker', props),
  NativeDropdown: (props: Record<string, unknown>) => mockCreateElement('native-dropdown', props),
  NativeSheet: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('native-sheet', props, children),
  NativeTextField: (props: Record<string, unknown>) =>
    mockCreateElement('native-text-field', props),
}));

jest.mock('@/components/premium', () => ({
  PremiumCard: ({ children, ...props }: { children?: ReactNode }) =>
    mockCreateElement('premium-card', props, children),
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { danger: '#FF0000', textPrimary: '#000000', textSecondary: '#666666' },
      spacing: { md: 16 },
      typography: { body: {}, footnote: {}, headline: {} },
    },
  }),
}));

function findNodes(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === type);
}

function findField(renderer: ReactTestRenderer, accessibilityLabel: string): ReactTestInstance {
  return findNodes(renderer, 'native-text-field').find(
    (node) => node.props.accessibilityLabel === accessibilityLabel,
  )!;
}

function findButton(renderer: ReactTestRenderer): ReactTestInstance {
  return findNodes(renderer, 'native-button')[0]!;
}

function renderSheet(
  onRegister: (input: Record<string, unknown>) => Promise<string>,
  outstandingAmount = 100,
  visible = true,
) {
  const onVisibleChange = jest.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(RetailOrderPaymentSheet, {
        onRegister,
        onVisibleChange,
        outstandingAmount,
        visible,
      }),
    );
  });
  return { onVisibleChange, renderer };
}

async function pressSubmit(renderer: ReactTestRenderer) {
  await act(async () => {
    findButton(renderer).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('RetailOrderPaymentSheet', () => {
  it('starts with the current outstanding amount and exposes the five methods', () => {
    const { renderer } = renderSheet(jest.fn().mockResolvedValue('payment-1'));

    expect(findField(renderer, 'Valor do pagamento').props.value).toBe(formatCurrency(100));
    expect(findNodes(renderer, 'native-dropdown')[0]?.props.items).toEqual([
      { label: 'Pix', value: 'Pix' },
      { label: 'Dinheiro', value: 'Dinheiro' },
      { label: 'Crédito', value: 'Crédito' },
      { label: 'Débito', value: 'Débito' },
      { label: 'Outro', value: 'Outro' },
    ]);
    const datePicker = findNodes(renderer, 'native-date-picker')[0];
    expect(parseIsoCalendarDate(formatDate(datePicker.props.value))).toBeDefined();
  });

  it('registers a partial posted payment with notes and card fee when applicable', async () => {
    const onRegister = jest.fn().mockResolvedValue('payment-1');
    const { onVisibleChange, renderer } = renderSheet(onRegister);

    act(() => findField(renderer, 'Valor do pagamento').props.onChangeText('40'));
    act(() => findNodes(renderer, 'native-dropdown')[0]?.props.onValueChange('Crédito'));
    act(() => findField(renderer, 'Taxa do cartão').props.onChangeText('2,50'));
    act(() => findField(renderer, 'Observações do pagamento').props.onChangeText(' Parcela 1 '));

    await pressSubmit(renderer);

    expect(onRegister).toHaveBeenCalledWith({
      amount: 40,
      cardFee: 2.5,
      method: 'Crédito',
      notes: 'Parcela 1',
      paidAt: expect.any(String),
      status: 'posted',
    });
    expect(onVisibleChange).toHaveBeenCalledWith(false);
    expect(findField(renderer, 'Valor do pagamento').props.value).toBe('');
  });

  it('clears card fee when switching to a non-card method', async () => {
    const onRegister = jest.fn().mockResolvedValue('payment-1');
    const { renderer } = renderSheet(onRegister);

    act(() => findNodes(renderer, 'native-dropdown')[0]?.props.onValueChange('Crédito'));
    act(() => findField(renderer, 'Taxa do cartão').props.onChangeText('2,50'));
    act(() => findNodes(renderer, 'native-dropdown')[0]?.props.onValueChange('Outro'));

    expect(
      findNodes(renderer, 'native-text-field').some(
        (node) => node.props.accessibilityLabel === 'Taxa do cartão',
      ),
    ).toBe(false);
    await pressSubmit(renderer);

    expect(onRegister).toHaveBeenCalledWith(
      expect.not.objectContaining({ cardFee: expect.anything() }),
    );
  });

  it('rejects zero and overpayment in the form without calling the datasource', async () => {
    const onRegister = jest.fn().mockResolvedValue('payment-1');
    const { renderer } = renderSheet(onRegister);

    for (const value of ['0', '101']) {
      act(() => findField(renderer, 'Valor do pagamento').props.onChangeText(value));
      await pressSubmit(renderer);
    }

    expect(onRegister).not.toHaveBeenCalled();
    expect(findButton(renderer).props.disabled).toBe(false);
  });

  it('blocks a second submit while the first registration is pending', async () => {
    let resolve!: (paymentId: string) => void;
    const pending = new Promise<string>((resolvePromise) => {
      resolve = resolvePromise;
    });
    const onRegister = jest.fn(() => pending);
    const { renderer } = renderSheet(onRegister);

    await act(async () => {
      findButton(renderer).props.onPress();
      await Promise.resolve();
    });
    expect(findButton(renderer).props.disabled).toBe(true);

    act(() => findButton(renderer).props.onPress());
    expect(onRegister).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve('payment-1');
      await pending;
    });
    expect(findButton(renderer).props.disabled).toBe(false);
  });

  it('keeps the sheet open after an error and allows retry', async () => {
    const onRegister = jest.fn<Promise<string>, [Record<string, unknown>]>();
    onRegister
      .mockRejectedValueOnce(new Error('Saldo insuficiente'))
      .mockResolvedValueOnce('payment-1');
    const { onVisibleChange, renderer } = renderSheet(onRegister);

    await pressSubmit(renderer);
    expect(onVisibleChange).not.toHaveBeenCalled();
    expect(findButton(renderer).props.disabled).toBe(false);

    await pressSubmit(renderer);
    expect(onRegister).toHaveBeenCalledTimes(2);
    expect(onVisibleChange).toHaveBeenCalledWith(false);
  });

  it('uses the new outstanding amount when opened again', () => {
    const onRegister = jest.fn().mockResolvedValue('payment-1');
    const { renderer } = renderSheet(onRegister, 100);

    act(() => {
      renderer.update(
        createElement(RetailOrderPaymentSheet, {
          onRegister,
          onVisibleChange: jest.fn(),
          outstandingAmount: 60,
          visible: false,
        }),
      );
    });
    act(() => {
      renderer.update(
        createElement(RetailOrderPaymentSheet, {
          onRegister,
          onVisibleChange: jest.fn(),
          outstandingAmount: 60,
          visible: true,
        }),
      );
    });

    expect(findField(renderer, 'Valor do pagamento').props.value).toBe(formatCurrency(60));
  });
});

function formatDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}
