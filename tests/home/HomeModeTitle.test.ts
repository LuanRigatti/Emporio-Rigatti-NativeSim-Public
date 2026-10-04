import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';

import HomeModeTitleFallback from '@/features/home/components/HomeModeTitleFallback';
import HomeModeTitleCompactRN from '@/features/home/components/HomeModeTitleCompactRN';

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    theme: {
      colors: { textPrimary: '#111111', textSecondary: '#666666' },
      spacing: { xxs: 4 },
      sizes: { touchTargetMinimum: 44 },
      typography: { headline: { fontSize: 17 }, largeTitle: {} },
      animations: { reducedMotion: { scale: 1 }, scale: { pressed: 0.97 } },
    },
    reduceMotionEnabled: false,
  }),
}));

const dashboardSource = readFileSync('src/app/(tabs)/dashboard/index.tsx', 'utf8');
const retailHomeSource = readFileSync('src/features/home/components/RetailHome.tsx', 'utf8');
const homeToolbarSource = readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8');
const tabsLayoutSource = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
const nativeTitleSource = readFileSync(
  'src/features/home/components/HomeModeTitleSwiftUI.ios.tsx',
  'utf8',
);
const compactRNTitleSource = readFileSync(
  'src/features/home/components/HomeModeTitleCompactRN.tsx',
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

  it.each(['Atacado', 'Varejo'])('renders the interactive RN compact title for %s', (label) => {
    const onPress = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(HomeModeTitleCompactRN, {
          accessibilityLabel: `Alterar modo. Modo atual: ${label}`,
          label,
          onPress,
        }),
      );
    });

    const action = renderer.root.find((node) => node.props.accessibilityRole === 'button');
    expect(action.props.accessibilityLabel).toBe(`Alterar modo. Modo atual: ${label}`);
    expect(action.props.hitSlop).toBe(8);
    expect(renderer.root.findAll((node) => node.props.children === label)).not.toHaveLength(0);

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
    expect(homeToolbarSource).toContain('<Stack.Toolbar.View>');
    expect(homeToolbarSource).toContain('<NativeHomeToolbarActions');
    expect(homeToolbarSource).toContain('mode="searchAction"');
    expect(homeToolbarSource).toContain('onSearchPress={onSearchPress}');
    expect(homeToolbarSource).toContain('searchAccessibilityLabel="Busca"');
    expect(dashboardSource).toContain('onSearchPress={handleOpenSearch}');
    expect(dashboardSource).toContain("router.push('/pesquisa')");
    expect(dashboardSource).not.toContain('HomeProfileSheet');
    expect(retailHomeSource).not.toContain('onSearchPress=');
    expect(retailHomeSource).not.toContain('HomeProfileSheet');
    expect(homeToolbarSource).not.toContain('onPress={modeSelector.open}');
  });

  it('keeps the existing NativeTabs layout and its five tab triggers', () => {
    expect(tabsLayoutSource).toContain('<NativeTabs');
    expect(tabsLayoutSource.match(/<NativeTabs\.Trigger name=/g)).toHaveLength(5);
    expect(tabsLayoutSource).toContain('<HomeProfileSheetProvider>');
  });

  it('uses an interactive RN compact title and keeps the large selector native', () => {
    expect(dashboardSource).toContain('compactTitle={renderHomeModeTitle()}');
    expect(retailHomeSource).toContain('compactTitle={renderHomeModeTitle()}');
    expect(dashboardSource).toContain('compactTitleInteractive');
    expect(retailHomeSource).toContain('compactTitleInteractive');
    expect(dashboardSource).toMatch(/title=\{\s*<HomeModeTitle/);
    expect(retailHomeSource).toMatch(/title=\{\s*<HomeModeTitle/);

    for (const source of [dashboardSource, retailHomeSource]) {
      const compactTitleRenderer = source.match(
        /const renderHomeModeTitle = \(\) => \([\s\S]*?\n  \);/,
      )?.[0];

      expect(compactTitleRenderer).toContain('<HomeModeTitleCompactRN');
      expect(compactTitleRenderer).toContain('{modeLabel}');
      expect(compactTitleRenderer).toContain('onPress={modeSelector.open}');
    }
    expect(compactRNTitleSource).toContain('<Pressable');
    expect(compactRNTitleSource).toContain('<AppText');
    expect(compactRNTitleSource).toContain('hitSlop={8}');
    expect(compactRNTitleSource).toContain('minHeight: theme.sizes.touchTargetMinimum');
    expect(compactRNTitleSource).toContain('theme.typography.headline.fontSize + 1');
    expect(compactRNTitleSource).not.toContain('Host');
    expect(compactRNTitleSource).toContain('onPress={onPress}');
    expect(nativeTitleSource).toContain('size: compact ? 17 : 36');
    expect(nativeTitleSource).toContain("weight: compact ? 'semibold' : 'bold'");
    expect(nativeTitleSource).toContain(
      "<Host matchContents ignoreSafeArea={isHomeLargeTitle ? 'container' : undefined}>",
    );
    expect(nativeTitleSource).toContain(
      "const isHomeLargeTitle = !compact && (label === 'Atacado' || label === 'Varejo');",
    );
    expect(nativeTitleSource).toContain('onPress={onPress}');
  });

  it('omits the mode chevrons while keeping native and fallback titles tappable', () => {
    const fallbackTitleSource = readFileSync(
      'src/features/home/components/HomeModeTitleFallback.tsx',
      'utf8',
    );

    expect(nativeTitleSource).not.toContain('chevron.up.chevron.down');
    expect(nativeTitleSource).toContain('onPress={onPress}');
    expect(fallbackTitleSource).not.toContain('chevron-expand-outline');
    expect(fallbackTitleSource).toContain('onPress={onPress}');
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
