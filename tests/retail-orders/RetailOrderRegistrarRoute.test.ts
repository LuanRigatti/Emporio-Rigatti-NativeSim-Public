/* eslint-disable @typescript-eslint/no-require-imports */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import RegistrarLayout from '@/app/(tabs)/registrar/_layout';
import RetailOrderCombinedRoute from '@/app/registrar-pedido-varejo/index';
import RetailOrderNewClientRoute from '@/app/registrar-pedido-varejo/novo-cliente';
import RetailOrderProductsRoute from '@/app/registrar-pedido-varejo/produtos';
import RetailOrderDetailsRoute from '@/app/registrar-pedido-varejo/detalhes';
import RetailOrderSummaryRoute from '@/app/registrar-pedido-varejo/resumo';

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const BackButton = (props: Record<string, unknown>) =>
    React.createElement('stack-back-button', props);
  const Screen = ({ children, ...props }: { children?: ReactNode }) =>
    React.createElement('stack-screen', props, children);
  Screen.BackButton = BackButton;
  const Stack = ({ children, ...props }: { children?: ReactNode }) =>
    React.createElement('stack', props, children);
  Stack.Screen = Screen;
  const Redirect = (props: { href: string }) => React.createElement('redirect', props);
  return { Redirect, Stack };
});

jest.mock('@/theme', () => ({
  useAppTheme: () => ({ resolvedMode: 'light' }),
}));

jest.mock('@/features/retail-orders/components/RetailOrderStepScreen', () => ({
  RetailOrderCombinedRegistrarScreen: () =>
    require('react').createElement('retail-order-combined-screen'),
  RetailOrderStepScreen: ({ step }: { step: string }) =>
    require('react').createElement('retail-order-step', { step }),
}));

jest.mock('@/features/retail-orders/components/RetailOrderNewClientScreen', () => ({
  RetailOrderNewClientScreen: () => require('react').createElement('retail-order-new-client'),
}));

const rootLayoutSource = readFileSync(resolve(process.cwd(), 'src/app/_layout.tsx'), 'utf8');

describe('RetailOrderRegistrarRoute', () => {
  function renderLayout() {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RegistrarLayout));
    });
    return renderer;
  }

  it('keeps the Registrar Stack focused on the existing tab flow', () => {
    const renderer = renderLayout();
    const stack = renderer.root.findAll((node) => String(node.type) === 'stack')[0];
    const screens = renderer.root.findAll((node) => String(node.type) === 'stack-screen');

    expect(screens.map((screen) => screen.props.name)).toEqual(['index', 'entrega', 'dados']);
    expect(stack.props.screenOptions).toEqual(
      expect.objectContaining({
        headerShown: true,
        headerShadowVisible: false,
        headerTransparent: true,
      }),
    );
    expect(screens[0].props.options).toEqual(
      expect.objectContaining({ gestureEnabled: false, headerShown: true }),
    );
    expect(
      screens
        .slice(1)
        .map(
          (screen) =>
            screen.findAll((node) => String(node.type) === 'stack-back-button')[0]?.props
              .displayMode,
        ),
    ).toEqual(['minimal', 'minimal']);
    expect(screens.slice(1).every((screen) => screen.props.options === undefined)).toBe(true);
  });

  it('registers the combined wizard entry, later steps, and legacy redirect in the Root Stack', () => {
    const routes = [
      ['registrar-pedido-varejo/index', 'Novo pedido'],
      ['registrar-pedido-varejo/novo-cliente', 'Novo cliente'],
      ['registrar-pedido-varejo/produtos', 'compatibilidade'],
      ['registrar-pedido-varejo/detalhes', 'Detalhes'],
      ['registrar-pedido-varejo/resumo', 'Resumo'],
    ] as const;

    for (const [route] of routes) {
      expect(rootLayoutSource).toContain(`name="${route}"`);
      expect(rootLayoutSource).toMatch(new RegExp(`name="${route}"[\\s\\S]{0,700}headerTitle: ''`));
    }
    expect(rootLayoutSource).not.toContain('retailWizardHeaderBackground');
    expect(rootLayoutSource).not.toContain('headerBackground:');
    expect(rootLayoutSource).not.toContain("title: 'Cliente'");
    expect(rootLayoutSource).not.toContain("title: 'Produtos'");
    expect(rootLayoutSource).not.toContain("title: 'Detalhes do pedido'");
    expect(rootLayoutSource).not.toContain("title: 'Resumo'");
    expect(rootLayoutSource).not.toContain('registrar-pedido-varejo/pagamento');
    expect(rootLayoutSource).toContain('hidesBottomBarWhenPushed: true');
    expect(rootLayoutSource).toContain('<RetailOrderFlowProvider>');
    expect(rootLayoutSource).toContain('</RetailOrderFlowProvider>');
    expect(rootLayoutSource).not.toContain('registrar-pedido-varejo/_layout');
    expect(existsSync(resolve(process.cwd(), 'src/app/registrar-pedido-varejo/_layout.tsx'))).toBe(
      false,
    );

    const stepScreenSource = readFileSync(
      resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderStepScreen.tsx'),
      'utf8',
    );
    expect(stepScreenSource).toContain('NativeGlassHeader');
    expect(stepScreenSource).toContain('getNativeLargeTitleStyle');
    expect(stepScreenSource).toContain('const STEP_TITLES');
    expect(stepScreenSource).toContain('title={null}');
    expect(stepScreenSource).toContain('largeTitle');
    expect(stepScreenSource).toContain("details: 'Detalhes'");
    expect(stepScreenSource).not.toContain("payment: 'Pagamento'");
    expect(stepScreenSource).toContain('overlayHeader={header}');
    expect(stepScreenSource).toContain('progressiveBlur');
    expect(stepScreenSource).not.toContain('useHeaderHeight');
    expect(stepScreenSource).toContain(
      "scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}",
    );
    expect(stepScreenSource).not.toContain("overflow: 'hidden'");
    expect(stepScreenSource).not.toContain('retailScrollDiagnostics');
    expect(stepScreenSource).not.toContain('RETAIL-SCROLL-DIAG');

    const premiumScreenSource = readFileSync(
      resolve(process.cwd(), 'src/components/premium/PremiumScreen.tsx'),
      'utf8',
    );
    expect(premiumScreenSource).toContain("style={{ overflow: 'visible' }}");
    expect(premiumScreenSource).not.toContain('scrollViewRef');
  });

  it('renders the combined Cliente + Produtos page at the wizard entry', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailOrderCombinedRoute));
    });

    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-combined-screen'),
    ).toHaveLength(1);
    expect(renderer.root.findAll((node) => String(node.type) === 'redirect')).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'retail-order-step')).toHaveLength(
      0,
    );
  });

  it('registers and renders the Retail new-client page in the Root Native Stack', () => {
    expect(rootLayoutSource).toMatch(
      /name="registrar-pedido-varejo\/novo-cliente"[\s\S]{0,700}hidesBottomBarWhenPushed: true[\s\S]{0,250}BackButton displayMode="default" withMenu=\{false\}/,
    );

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailOrderNewClientRoute));
    });
    expect(
      renderer.root.findAll((node) => String(node.type) === 'retail-order-new-client'),
    ).toHaveLength(1);
  });

  it.each([
    [RetailOrderDetailsRoute, 'details'],
    [RetailOrderSummaryRoute, 'summary'],
  ] as const)('%s renders only the shared retail step content', (Route, step) => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(Route));
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'stack')).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'stack-title')).toHaveLength(0);
    expect(renderer.root.findAll((node) => String(node.type) === 'stack-back-button')).toHaveLength(
      0,
    );
    const stepScreens = renderer.root.findAll((node) => String(node.type) === 'retail-order-step');
    expect(stepScreens).toHaveLength(1);
    expect(stepScreens[0].props.step).toBe(step);
  });

  it('redirects the legacy Produtos route to the combined wizard entry', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailOrderProductsRoute));
    });

    expect(renderer.root.findAll((node) => String(node.type) === 'redirect')[0].props.href).toBe(
      '/registrar-pedido-varejo',
    );
    expect(renderer.root.findAll((node) => String(node.type) === 'retail-order-step')).toHaveLength(
      0,
    );
  });
});
