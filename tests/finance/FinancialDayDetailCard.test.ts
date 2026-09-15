import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { FinancialDayDetailCard } from '@/features/finance/components/FinancialDayDetailCard';
import type { FinancialDailyDetail } from '@/services/finance';

function MockNativeAnimatedNumber(props: Record<string, unknown>) {
  return createElement('MockNativeAnimatedNumber', props);
}

function MockIonicons(props: Record<string, unknown>) {
  return createElement('MockIonicons', props);
}

function mockAnimatedView({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return createElement('AnimatedView', props, children);
}

jest.mock('@/components/native', () => ({ NativeAnimatedNumber: MockNativeAnimatedNumber }));
jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: MockIonicons,
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  Easing: { out: (value: unknown) => value, quad: 'quad' },
  FadeInDown: {
    duration: () => ({ springify: () => ({ damping: () => ({ stiffness: () => ({}) }) }) }),
  },
  FadeOutUp: { duration: () => ({}) },
  LinearTransition: { duration: () => ({ easing: () => ({}) }) },
  default: { View: mockAnimatedView },
}));
jest.mock('@/theme', () => ({
  getCardSurfaceColor: (_mode: string, surface: string) => surface,
  useAppTheme: () => ({
    resolvedMode: 'dark',
    theme: {
      colors: {
        separator: '#333333',
        surface: '#111111',
        textPrimary: '#FFFFFF',
        textSecondary: '#AAAAAA',
      },
      radius: { xl: 24 },
      shadows: { card: {}, none: {} },
      sizes: { iconSmall: 16 },
      spacing: { sm: 4 },
      typography: {
        footnote: { fontSize: 13 },
        subheadline: { fontSize: 15, lineHeight: 20 },
      },
    },
  }),
}));

function detail(overrides: Partial<FinancialDailyDetail> = {}): FinancialDailyDetail {
  return {
    date: '2026-09-06',
    manualKilometers: 3,
    automaticKilometers: 5,
    routeCount: 1,
    summary: {
      custoCombustivel: 20,
      custoEstar: 10,
      custoLuz: 8,
      custoMedioBalde: 12,
      custoMedioCombustivelPorEntrega: 20,
      custoOutros: 6,
      custoTotal: 79,
      custoTotalBaldes: 35,
      faturamento: 100,
      lucroBruto: 65,
      lucroLiquido: 21,
      lucroLiquidoPorBalde: 21,
      margemBruta: 65,
      margemLiquida: 21,
      precoMedioBalde: 100,
      quantidadeBaldes: 1,
      quantidadeEntregas: 1,
      valoresPagos: 100,
      valoresPendentes: 0,
    },
    totalKilometers: 8,
    ...overrides,
  };
}

function renderCard(metric: 'faturamento' | 'lucroLiquido', value = detail()) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(
      createElement(FinancialDayDetailCard, {
        detail: value,
        metric,
        animateRowEntrance: false,
      }),
    );
  });
  return renderer!;
}

function renderedLabels(renderer: ReactTestRenderer): string[] {
  const values: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      values.push(node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const candidate = node as { children?: unknown[]; props?: { children?: unknown } };
    if (Array.isArray(candidate.children)) candidate.children.forEach(visit);
    if (candidate.props?.children !== undefined) visit(candidate.props.children);
  };
  visit(renderer.toJSON());
  return values;
}

function nativeNumberValues(renderer: ReactTestRenderer): unknown[] {
  return renderer.root.findAllByType(MockNativeAnimatedNumber).map((node) => node.props.value);
}

describe('FinancialDayDetailCard', () => {
  const costLabels = [
    'Lucro líquido',
    'Estar',
    'Km total',
    'Km automático',
    'Km manual',
    'Custo de combustível',
    'Outros',
    'Luz do período',
  ];

  it('shows only revenue metrics for Faturamento', () => {
    const renderer = renderCard('faturamento');
    const labels = renderedLabels(renderer);

    expect(labels).toEqual(expect.arrayContaining(['Faturamento', 'Baldes vendidos', 'Entregas']));
    costLabels.forEach((label) => expect(labels).not.toContain(label));
  });

  it('keeps Faturamento unchanged when kilometers and fuel costs change', () => {
    const first = renderCard('faturamento');
    const changed = detail({
      automaticKilometers: 80,
      manualKilometers: 40,
      summary: { ...detail().summary, custoCombustivel: 250, faturamento: 100 },
      totalKilometers: 120,
    });
    const second = renderCard('faturamento', changed);

    expect(nativeNumberValues(first)[0]).toBe(100);
    expect(nativeNumberValues(second)[0]).toBe(100);
  });

  it('keeps the existing cost metrics for Lucro Líquido', () => {
    const renderer = renderCard('lucroLiquido');
    const labels = renderedLabels(renderer);

    expect(labels).not.toContain('Faturamento');
    costLabels.forEach((label) => expect(labels).toContain(label));
  });

  it('switches between the metric-specific row sets', () => {
    const renderer = renderCard('faturamento');

    act(() => {
      renderer.update(
        createElement(FinancialDayDetailCard, {
          detail: detail(),
          metric: 'lucroLiquido',
          animateRowEntrance: false,
        }),
      );
    });
    expect(renderedLabels(renderer)).toContain('Custo de combustível');
    expect(renderedLabels(renderer)).not.toContain('Faturamento');

    act(() => {
      renderer.update(
        createElement(FinancialDayDetailCard, {
          detail: detail(),
          metric: 'faturamento',
          animateRowEntrance: false,
        }),
      );
    });
    expect(renderedLabels(renderer)).toEqual(
      expect.arrayContaining(['Faturamento', 'Baldes vendidos', 'Entregas']),
    );
    expect(renderedLabels(renderer)).not.toContain('Custo de combustível');
  });
});
