/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import RetailProductCreateRoute from '@/app/catalogo-varejo/produto/novo';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ categoryId: 'category-1' }),
}));

jest.mock('@/features/retail-catalog/components/RetailProductEditScreen', () => ({
  RetailProductEditScreen: (props: Record<string, unknown>) => {
    const React = require('react') as typeof import('react');
    return React.createElement('retail-product-edit-screen', props);
  },
}));

describe('retail product create route', () => {
  it('opens the shared product page in create mode with the category parameter', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(RetailProductCreateRoute));
    });

    const screen = renderer.root.findAll(
      (node) => String(node.type) === 'retail-product-edit-screen',
    )[0];
    expect(screen.props).toEqual({ initialCategoryId: 'category-1', mode: 'create' });
  });
});
