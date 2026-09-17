/* eslint-disable @typescript-eslint/no-require-imports */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import RegistrarLayout from '@/app/(tabs)/registrar/_layout';
import RetailOrderClientRoute from '@/app/registrar-pedido-varejo/index';
import RetailOrderProductsRoute from '@/app/registrar-pedido-varejo/produtos';
import RetailOrderDetailsRoute from '@/app/registrar-pedido-varejo/detalhes';
import RetailOrderSummaryRoute from '@/app/registrar-pedido-varejo/resumo';
import RetailOrderPaymentRoute from '@/app/registrar-pedido-varejo/pagamento';

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
  return { Stack };
});

jest.mock('@/theme', () => ({
  useAppTheme: () => ({ resolvedMode: 'light' }),
}));

jest.mock('@/features/retail-orders/components/RetailOrderStepScreen', () => ({
  RetailOrderStepScreen: ({ step }: { step: string }) =>
    require('react').createElement('retail-order-step', { step }),
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

    expect(screens.map((screen) => screen.props.name)).toEqual(['index']);
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
    expect(renderer.root.findAll((node) => String(node.type) === 'stack-back-button')).toHaveLength(
      0,
    );
  });

  it('registers every retail wizard page with the prior transparent Root Stack header and stable back', () => {
    const routes = [
      ['registrar-pedido-varejo/index', 'Cliente'],
      ['registrar-pedido-varejo/produtos', 'Produtos'],
      ['registrar-pedido-varejo/detalhes', 'Detalhes do pedido'],
      ['registrar-pedido-varejo/resumo', 'Resumo'],
      ['registrar-pedido-varejo/pagamento', 'Pagamento inicial'],
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
    expect(rootLayoutSource).not.toContain("title: 'Pagamento inicial'");
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
    expect(stepScreenSource).toContain('const STEP_TITLES');
    expect(stepScreenSource).toContain('overlayHeader={header}');
    expect(stepScreenSource).toContain('progressiveBlur');
    expect(stepScreenSource).not.toContain('useHeaderHeight');
    expect(stepScreenSource).not.toContain('scrollViewProps');
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

  it.each([
    [RetailOrderClientRoute, 'client'],
    [RetailOrderProductsRoute, 'products'],
    [RetailOrderDetailsRoute, 'details'],
    [RetailOrderSummaryRoute, 'summary'],
    [RetailOrderPaymentRoute, 'payment'],
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
});
