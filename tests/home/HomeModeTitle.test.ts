import { create, act } from 'react-test-renderer';
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
    },
  }),
}));

const dashboardSource = readFileSync('src/app/(tabs)/dashboard/index.tsx', 'utf8');
const retailHomeSource = readFileSync('src/features/home/components/RetailHome.tsx', 'utf8');
const homeToolbarSource = readFileSync('src/components/navigation/HomeToolbar.tsx', 'utf8');
const tabsLayoutSource = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
const progressiveScreenSource = readFileSync(
  'src/components/premium/ProgressiveCollapsibleScreen.tsx',
  'utf8',
);
const nativeTitleSource = readFileSync(
  'src/features/home/components/HomeModeTitleSwiftUI.ios.tsx',
  'utf8',
);
const fallbackTitleSource = readFileSync(
  'src/features/home/components/HomeModeTitleFallback.tsx',
  'utf8',
);
const compactRNTitleSource = readFileSync(
  'src/features/home/components/HomeModeTitleCompactRN.tsx',
  'utf8',
);

describe('Home mode title', () => {
  it.each(['Atacado', 'Varejo'])('renders the large fallback title %s as static text', (label) => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createElement(HomeModeTitleFallback, { label }));
    });

    expect(renderer.root.findAll((node) => node.props.children === label)).not.toHaveLength(0);
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === 'button')).toHaveLength(
      0,
    );
    expect(renderer.root.findAll((node) => typeof node.props.onPress === 'function')).toHaveLength(
      0,
    );
  });

  it.each(['Atacado', 'Varejo'])(
    'renders the compact title %s without a button affordance',
    (label) => {
      let renderer!: ReturnType<typeof create>;

      act(() => {
        renderer = create(createElement(HomeModeTitleCompactRN, { label }));
      });

      expect(renderer.root.findAll((node) => node.props.children === label)).not.toHaveLength(0);
      expect(
        renderer.root.findAll((node) => node.props.accessibilityRole === 'button'),
      ).toHaveLength(0);
      expect(
        renderer.root.findAll((node) => typeof node.props.onPress === 'function'),
      ).toHaveLength(0);
    },
  );

  it('keeps both title sizes unchanged while routing mode selection through the toolbar', () => {
    expect(dashboardSource).toContain("const homeTitle = 'Home';");
    expect(retailHomeSource).toContain("const homeTitle = 'Home';");
    expect(dashboardSource).toContain('title={<HomeModeTitle label={homeTitle} />}');
    expect(retailHomeSource).toContain('title={<HomeModeTitle label={homeTitle} />}');
    expect(dashboardSource).toContain('compactTitle={renderHomeModeTitle()}');
    expect(retailHomeSource).toContain('compactTitle={renderHomeModeTitle()}');
    expect(dashboardSource).toContain('compactTitleAccessibilityManaged');
    expect(retailHomeSource).toContain('compactTitleAccessibilityManaged');

    for (const source of [dashboardSource, retailHomeSource]) {
      expect(source).not.toContain('onPress={modeSelector.open}');
      expect(source).not.toContain('accessibilityLabel={`Alterar modo. Modo atual: ${modeLabel}`}');
      expect(source).toContain('const renderHomeModeTitle = () => <HomeModeTitleCompactRN');
      expect(source).toContain('label={homeTitle}');
      expect(source).not.toContain("modeSelector.mode === 'retail' ? 'Varejo' : 'Atacado'");
    }

    expect(homeToolbarSource).toContain('onModePress={modeSelector.open}');
    expect(homeToolbarSource).toContain('mode="modeAndSearchActions"');
    expect(homeToolbarSource).toContain('mode="modeOnlyAction"');
    expect(homeToolbarSource).toContain('visible={modeSelector.visible}');
    expect(homeToolbarSource).toContain('onDismiss={modeSelector.onDismiss}');
    expect(dashboardSource).toContain('onSearchPress={handleOpenSearch}');
    expect(dashboardSource).toContain("router.push('/pesquisa')");
    expect(retailHomeSource).not.toContain('onSearchPress=');
    expect(dashboardSource).not.toContain('HomeProfileSheet');
    expect(retailHomeSource).not.toContain('HomeProfileSheet');
  });

  it('keeps the existing NativeTabs layout and its four tab triggers', () => {
    expect(tabsLayoutSource).toContain('<NativeTabs');
    expect(tabsLayoutSource.match(/<NativeTabs\.Trigger name=/g)).toHaveLength(4);
    expect(tabsLayoutSource).toContain('<HomeProfileSheetProvider>');
  });

  it('keeps the large iOS title native and removes interactive and pressed semantics', () => {
    expect(nativeTitleSource).toContain('size: compact ? 17 : 37');
    expect(nativeTitleSource).toContain("weight: compact ? 'semibold' : 'bold'");
    expect(nativeTitleSource).toContain(
      "<Host matchContents ignoreSafeArea={isHomeLargeTitle ? 'container' : undefined}>",
    );
    expect(nativeTitleSource).toContain('<Text modifiers={[titleFont, foregroundColor');
    expect(nativeTitleSource).toContain('{label}</Text>');
    expect(nativeTitleSource).toContain('const isHomeLargeTitle = !compact;');
    expect(nativeTitleSource).not.toContain('Pressable');
    expect(nativeTitleSource).not.toContain('Animated');
    expect(nativeTitleSource).not.toContain('onPress');
    expect(nativeTitleSource).not.toContain('accessibilityRole');
    expect(fallbackTitleSource).toContain('theme.typography.largeTitle');
    expect(fallbackTitleSource).toContain('theme.typography.headline');
    expect(fallbackTitleSource).toContain('fontSize: 37');
    expect(fallbackTitleSource).not.toContain('Pressable');
    expect(fallbackTitleSource).not.toContain('chevron-expand-outline');
    expect(fallbackTitleSource).not.toContain('onPress');
  });

  it('keeps the compact title layout and accessibility switching without making it touchable', () => {
    expect(compactRNTitleSource).toContain('<View');
    expect(compactRNTitleSource).toContain('<AppText');
    expect(compactRNTitleSource).toContain('minHeight: theme.sizes.touchTargetMinimum');
    expect(compactRNTitleSource).toContain('theme.typography.headline.fontSize + 1');
    expect(compactRNTitleSource).not.toContain('Pressable');
    expect(compactRNTitleSource).not.toContain('hitSlop');
    expect(compactRNTitleSource).not.toContain('onPress');
    expect(progressiveScreenSource).toContain('compactTitleAccessibilityManaged');
    expect(progressiveScreenSource).toContain('accessibilityElementsHidden');
    expect(progressiveScreenSource).toContain('pointerEvents="none"');
    expect(progressiveScreenSource).not.toContain('compactTitleInteractive');
  });
});
