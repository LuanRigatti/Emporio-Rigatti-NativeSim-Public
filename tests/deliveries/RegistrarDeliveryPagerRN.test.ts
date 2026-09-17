/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';

import RegistrarDeliveryPagerRN from '@/components/native/NativeBottomSheet/RegistrarDeliveryPagerRN';

jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react') as typeof import('react');
  return {
    Host: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement('native-host', props, children),
  };
});

function styleWidth(node: ReactTestInstance): number | undefined {
  const styles = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
  const widthStyle = styles.find(
    (style) => style && typeof style === 'object' && 'width' in style,
  ) as { width?: number } | undefined;
  return widthStyle?.width;
}

function pageViews(renderer: ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll((node) => {
    const width = styleWidth(node);
    return typeof width === 'number' && width > 0;
  });
}

describe('RegistrarDeliveryPagerRN', () => {
  it('mounts both pages with a non-zero responsive width before the first layout callback', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RegistrarDeliveryPagerRN, {
          detailPage: createElement('detail-page'),
          listPage: createElement('list-page'),
          onPageSettled: jest.fn(),
          requestedPage: 0,
        }),
      );
    });

    const widths = pageViews(renderer).map(styleWidth);
    expect(widths.length).toBeGreaterThanOrEqual(2);
    expect(widths.every((width) => (width ?? 0) > 0)).toBe(true);
  });

  it('updates both page widths after a valid container resize', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RegistrarDeliveryPagerRN, {
          detailPage: createElement('detail-page'),
          listPage: createElement('list-page'),
          onPageSettled: jest.fn(),
          requestedPage: 0,
        }),
      );
    });

    const layoutNode = renderer.root.findAll(
      (node) => typeof node.props.onLayout === 'function',
    )[0];
    act(() => {
      layoutNode.props.onLayout({ nativeEvent: { layout: { height: 500, width: 402 } } });
    });

    expect(pageViews(renderer).map(styleWidth)).toEqual(expect.arrayContaining([402, 402]));
  });

  it('settles page changes from the horizontal pager', () => {
    const onPageSettled = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(RegistrarDeliveryPagerRN, {
          detailPage: createElement('detail-page'),
          listPage: createElement('list-page'),
          onPageSettled,
          requestedPage: 0,
        }),
      );
    });

    const scrollView = renderer.root.findAll((node) => node.props.pagingEnabled)[0];
    act(() => {
      scrollView.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 800, y: 0 } },
      });
    });

    expect(onPageSettled).toHaveBeenCalledWith(1);
  });
});
