/* eslint-disable @typescript-eslint/no-require-imports */

import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';

import HomeModeTitleFallback from '@/features/home/components/HomeModeTitleFallback';

jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('ionicon', props),
  };
});

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { textPrimary: '#111111', textSecondary: '#666666' },
      spacing: { xxs: 4 },
      typography: { largeTitle: {} },
      animations: { reducedMotion: { scale: 1 }, scale: { pressed: 0.97 } },
    },
    reduceMotionEnabled: false,
  }),
}));

const dashboardSource = readFileSync('src/app/(tabs)/dashboard/index.tsx', 'utf8');
const retailHomeSource = readFileSync('src/features/home/components/RetailHome.tsx', 'utf8');
const homeToolbarSource = readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8');
const nativeTitleSource = readFileSync(
  'src/features/home/components/HomeModeTitleSwiftUI.ios.tsx',
  'utf8',
);

describe('Home mode title', () => {
  it.each([
    ['Atacado', 'Alterar modo. Modo atual: Atacado'],
    ['Varejo', 'Alterar modo. Modo atual: Varejo'],
  ])('renders %s with an accessible action', (label, accessibilityLabel) => {
    const onPress = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(HomeModeTitleFallback, {
          accessibilityLabel,
          label,
          onPress,
        }),
      );
    });

    const action = renderer.root.find((node) => node.props.accessibilityRole === 'button');
    expect(action.props.accessibilityLabel).toBe(accessibilityLabel);
    expect(renderer.root.findAll((node) => node.props.children === label)).not.toHaveLength(0);

    const pressedStyles = action.props.style({ pressed: true });
    expect(pressedStyles).toEqual(
      expect.arrayContaining([expect.objectContaining({ transform: [{ scale: 0.97 }] })]),
    );

    act(() => action.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the title as the AppMode selector and the toolbar as Search', () => {
    expect(dashboardSource).toContain("modeSelector.mode === 'retail' ? 'Varejo' : 'Atacado'");
    expect(dashboardSource).toContain('onPress={modeSelector.open}');
    expect(dashboardSource).toContain('modeSelector={modeSelector}');
    expect(retailHomeSource).toContain("modeSelector.mode === 'retail' ? 'Varejo' : 'Atacado'");
    expect(retailHomeSource).toContain('onPress={modeSelector.open}');
    expect(retailHomeSource).toContain('modeSelector={modeSelector}');
    expect(homeToolbarSource).toContain('visible={modeSelector.visible}');
    expect(homeToolbarSource).toContain('onDismiss={modeSelector.onDismiss}');
    expect(homeToolbarSource).toContain('<Stack.Toolbar placement="left">');
    expect(homeToolbarSource).toContain('<Stack.Toolbar placement="right">');
    expect(homeToolbarSource).toContain('<Stack.Toolbar.Button');
    expect(homeToolbarSource).toContain('onPress={onSearchPress}');
    expect(homeToolbarSource).toContain('<Stack.Toolbar.Icon sf="magnifyingglass" />');
    expect(homeToolbarSource).toContain('<Stack.Toolbar.Label>PESQUISA</Stack.Toolbar.Label>');
    expect(homeToolbarSource).not.toContain('onPress={modeSelector.open}');
  });

  it('uses the native vertical chevron symbol on the iOS implementation', () => {
    expect(nativeTitleSource).toContain('chevron.up.chevron.down');
    expect(nativeTitleSource).toContain('size={15}');
    expect(nativeTitleSource).toContain('offset({ y: 3 })');
  });

  it('arms the iOS pressed scale without changing the fallback path', () => {
    expect(nativeTitleSource).toContain('<Pressable');
    expect(nativeTitleSource).toContain('const PRESSED_SCALE = 0.96');
    expect(nativeTitleSource).toContain('const PRESS_IN_DURATION = 55');
    expect(nativeTitleSource).toContain('const PRESS_OUT_DURATION = 150');
    expect(nativeTitleSource).toContain(
      'duration: reduceMotionEnabled ? 0 : pressed ? PRESS_IN_DURATION : PRESS_OUT_DURATION',
    );
    expect(nativeTitleSource).toContain(
      'toValue: pressed && !reduceMotionEnabled ? PRESSED_SCALE : 1',
    );
    expect(nativeTitleSource).toContain('onPress={onPress}');
    expect(nativeTitleSource).toContain('transform: [{ scale }]');
    expect(nativeTitleSource).not.toContain("buttonStyle('plain')");
    expect(
      readFileSync('src/features/home/components/HomeModeTitleFallback.tsx', 'utf8'),
    ).toContain('theme.animations.scale.pressed');
  });
});
