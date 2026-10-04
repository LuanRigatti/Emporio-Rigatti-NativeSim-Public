/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';

import { HomeProfileSheet } from '@/features/home/profile/HomeProfileSheet';

const mockAuthState = {
  error: null,
  isLoading: false,
  sessionVersion: 1,
  signOut: jest.fn(),
  updateDisplayName: jest.fn(),
  user: {
    id: 'user-1',
    displayName: 'Luan Rigatti',
    email: 'luan@example.com',
    photoUrl: null,
  },
};

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');

  return {
    NativeBottomSheet: ({
      children,
      content,
      ...props
    }: {
      children?: ReactNode;
      content?: ReactNode;
    }) => React.createElement('native-bottom-sheet', props, content ?? children),
  };
});

jest.mock('@/providers', () => ({ useAuth: () => mockAuthState }));
jest.mock('@/services/routes', () => ({
  locationTrackingService: { stopActiveRouteForLogout: jest.fn() },
}));
jest.mock('@/theme', () => ({
  lightModeLiquidGlassTint: 'rgba(255, 255, 255, 0.6)',
}));
jest.mock('@/features/home/profile/HomeProfileSheetContent', () => {
  const React = require('react') as typeof import('react');

  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('profile-content', props),
  };
});

function findNodes(instance: ReactTestInstance, type: string) {
  return instance.findAll((node) => String(node.type) === type);
}

describe('HomeProfileSheet presentation', () => {
  it('uses white-tinted native Glass and modal dimming', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(HomeProfileSheet, {
          onVisibleChange: jest.fn(),
          visible: true,
        }),
      );
    });

    const sheet = findNodes(renderer.root, 'native-bottom-sheet')[0];

    expect(sheet.props.presentationBackgroundColor).toBeUndefined();
    expect(sheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(sheet.props.glassSurface).toBe(true);
    expect(sheet.props.glassTint).toBe('rgba(255, 255, 255, 0.6)');
    expect(sheet.props.presentationBackgroundMode).toBeUndefined();
    expect(sheet.props.detents).toEqual([{ fraction: 0.5 }]);
    expect(sheet.props.initialDetent).toEqual({ fraction: 0.5 });
    expect(sheet.props.visible).toBe(true);
    expect(findNodes(renderer.root, 'profile-content')).toHaveLength(1);
  });
});

describe('NativeBottomSheet shared presentation defaults', () => {
  const nativeBottomSheetSource = readFileSync(
    resolve(
      process.cwd(),
      'src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx',
    ),
    'utf8',
  );

  it('keeps native background interaction enabled by default', () => {
    expect(nativeBottomSheetSource).toMatch(
      /presentationBackgroundInteraction:\s*backgroundInteraction\s*=\s*'enabled'/,
    );
  });

  it('routes an explicit presentation color to the native background modifier', () => {
    expect(nativeBottomSheetSource).toMatch(
      /presentationBackgroundColor\s*\?\s*presentationBackground\(presentationBackgroundColor\)/,
    );
  });
});
