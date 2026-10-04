import { readFileSync } from 'node:fs';

const premiumScreenSource = readFileSync('src/components/premium/PremiumScreen.tsx', 'utf8');
const nativeHeaderSource = readFileSync(
  'src/components/layout/NativeGlassHeader/NativeGlassHeader.tsx',
  'utf8',
);
const progressiveBlurSource = readFileSync('src/components/ui/progressive-blur.tsx', 'utf8');
const constantsSource = readFileSync(
  'src/components/premium/PremiumScreenCollapsibleTitleConstants.ts',
  'utf8',
);
const progressiveCollapsibleScreenSource = readFileSync(
  'src/components/premium/ProgressiveCollapsibleScreen.tsx',
  'utf8',
);
const historyScreenSource = readFileSync(
  'src/features/history/components/HistoryScreen.tsx',
  'utf8',
);

describe('PremiumScreen collapsible title contract', () => {
  it('keeps collapsible titles opt-in and tracks scroll on the UI thread', () => {
    expect(premiumScreenSource).toContain('collapsibleTitle?: PremiumScreenCollapsibleTitle');
    expect(premiumScreenSource).toContain('useSharedValue(0)');
    expect(premiumScreenSource).toContain('useAnimatedScrollHandler');
    expect(premiumScreenSource).toContain('scrollY.value = Math.max(0, event.contentOffset.y)');
    expect(premiumScreenSource).toContain('<Animated.ScrollView');
    expect(premiumScreenSource).toContain('hasCollapsibleTitle ? (');
    expect(premiumScreenSource).toContain('<ScrollView');
  });

  it('composes an existing scroll callback and only bridges semantic accessibility changes', () => {
    expect(premiumScreenSource).toContain('runOnJS(forwardExternalScrollEvent)');
    expect(premiumScreenSource).toContain('runOnJS(setCompactTitleActive)');
    expect(premiumScreenSource).toContain('nextCompactTitleActive === previousCompactTitleActive');
    expect(premiumScreenSource).toContain(
      'scrollEventThrottle={scrollViewProps?.scrollEventThrottle ?? 16}',
    );
  });

  it('uses the audited fade/translate ranges and a discrete reduced-motion switch', () => {
    expect(constantsSource).toContain('PREMIUM_TITLE_LARGE_FADE_RANGE = [0, 60]');
    expect(constantsSource).toContain('PREMIUM_TITLE_COMPACT_FADE_RANGE = [40, 80]');
    expect(constantsSource).toContain('PREMIUM_TITLE_COMPACT_TRANSLATE_Y = 20');
    expect(nativeHeaderSource).toContain('interpolate(');
    expect(nativeHeaderSource).toContain('translateY: interpolate(');
    expect(nativeHeaderSource).toContain('if (reduceMotionEnabled)');
    expect(nativeHeaderSource).toContain('accessibilityElementsHidden={!isVisible}');
    expect(nativeHeaderSource).toContain(
      "importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}",
    );
  });

  it('extends the existing progressive blur below the measured fixed header only for collapsible titles', () => {
    expect(premiumScreenSource).toContain('theme.spacing.xxl + theme.spacing.xs * 2');
    expect(premiumScreenSource).toContain(
      'overlayHeaderTotalHeight + collapsibleTitleBlurTail - progressiveBlurTopOffset',
    );
    expect(premiumScreenSource).toContain('shouldRenderProgressiveBlur &&');
    expect(premiumScreenSource).toContain('hasCollapsibleTitle &&');
    expect(premiumScreenSource).toContain('progressiveBlurTopOffset !== 0');
    expect(premiumScreenSource).toContain(
      'hasCollapsibleTitle && !usesCustomProgressiveBlurOffset',
    );
    expect(premiumScreenSource).toContain('fadeStart={');
  });

  it('fades the compact title blur with the shared scroll value on the UI thread', () => {
    expect(constantsSource).toContain('PREMIUM_TITLE_COMPACT_BLUR_RANGE = [0, 100]');
    expect(constantsSource).toContain('PREMIUM_TITLE_COMPACT_BLUR_MAX_INTENSITY = 50');
    expect(nativeHeaderSource).toContain('Animated.createAnimatedComponent(BlurView)');
    expect(nativeHeaderSource).toContain('useAnimatedProps(');
    expect(nativeHeaderSource).toContain('animatedProps={animatedProps}');
    expect(nativeHeaderSource).toContain('scrollY.value');
    expect(nativeHeaderSource).toContain('pointerEvents="none"');
    expect(nativeHeaderSource).toContain("Platform.OS === 'ios'");
  });

  it('places the compact-title blur across the fixed header instead of the text bounds', () => {
    const animatedTitleContent = nativeHeaderSource.slice(
      nativeHeaderSource.indexOf('function AnimatedTitleContent'),
      nativeHeaderSource.indexOf('export function getNativeLargeTitleStyle'),
    );

    expect(animatedTitleContent).not.toContain('AnimatedBlurView');
    expect(nativeHeaderSource).toContain('styles.topRow');
    expect(nativeHeaderSource).toContain('compactHeaderSafeAreaInset');
    expect(nativeHeaderSource).toContain('left: -horizontalInset');
    expect(nativeHeaderSource).toContain('right: -horizontalInset');
    expect(nativeHeaderSource).toContain('horizontalInset={theme.layout.screenHorizontalPadding}');
    expect(nativeHeaderSource).toContain('styles.actionsAboveCompactHeaderBlur');
  });

  it('fades the compact-header blur edge with the existing progressive mask strategy', () => {
    expect(nativeHeaderSource).toContain('<ProgressiveBlurMask');
    expect(nativeHeaderSource).toContain('locations={[0, 0.56, 0.76, 0.96, 1]}');
    expect(progressiveBlurSource).toContain('export function ProgressiveBlurMask');
    expect(progressiveBlurSource).toContain('<MaskedView');
    expect(progressiveBlurSource).toContain('<LinearGradient');
    expect(progressiveBlurSource).toContain('<ProgressiveBlurMask');
    expect(premiumScreenSource).toContain('height={resolvedProgressiveBlurHeight}');
  });

  it('preserves the validated shared pipeline and compensates the external header offset', () => {
    expect(progressiveCollapsibleScreenSource).toContain('FIXED_HEADER_HEIGHT = 100');
    expect(progressiveCollapsibleScreenSource).toContain('NATIVE_HEADER_PIPELINE_RAISE = 28');
    expect(progressiveCollapsibleScreenSource).toContain('SMALL_HEADER_TITLE_FONT_SIZE = 17');
    expect(progressiveCollapsibleScreenSource).toContain(
      'SMALL_HEADER_TITLE_FONT_SIZE + (nativeTabRoot ? 1 : 0)',
    );
    expect(progressiveCollapsibleScreenSource).toContain('nativeTabRoot?: boolean');
    expect(progressiveCollapsibleScreenSource).toContain(
      "nativeHeader || (nativeTabRoot && Platform.OS === 'ios')",
    );
    expect(progressiveCollapsibleScreenSource).toContain('height: 150');
    expect(progressiveCollapsibleScreenSource).toContain(
      'interpolate(scrollY.value, [0, 60], [1, 0]',
    );
    expect(progressiveCollapsibleScreenSource).toContain(
      'interpolate(scrollY.value, [40, 80], [0, 1]',
    );
    expect(progressiveCollapsibleScreenSource).toContain(
      'interpolate(scrollY.value, [40, 80], [20, 0]',
    );
    expect(progressiveCollapsibleScreenSource).toContain('marginTop: rootStackOffset');
    expect(progressiveCollapsibleScreenSource).toContain('AnimatedBlurView');
    expect(progressiveCollapsibleScreenSource).toContain('style={StyleSheet.absoluteFill}');
    expect(progressiveCollapsibleScreenSource).toContain('<Animated.ScrollView');
    expect(progressiveCollapsibleScreenSource).toContain('onScroll={onScroll}');
    expect(progressiveCollapsibleScreenSource).toContain(
      'insets.top + contentTopInset - baseRootStackOffset',
    );
    expect(progressiveCollapsibleScreenSource).toContain('compactTitle: ReactNode');
  });

  it.each([
    ['src/app/(tabs)/dashboard/index.tsx', 1],
    ['src/features/home/components/RetailHome.tsx', 1],
    ['src/app/(tabs)/financeiro/index.tsx', 2],
    ['src/app/(tabs)/registrar/index.tsx', 1],
    ['src/features/retail-orders/components/RetailOrderRegistrarScreen.tsx', 1],
    ['src/features/history/components/HistoryScreen.tsx', 1],
    ['src/features/retail-orders/components/RetailOrderHistoryScreen.tsx', 1],
    ['src/features/settings/components/SettingsScreen.tsx', 1],
  ] as const)('uses the shared native tab-root geometry in %s', (path, expectedUsageCount) => {
    const source = readFileSync(path, 'utf8');
    expect(source.match(/nativeTabRoot/g)).toHaveLength(expectedUsageCount);
  });

  it.each([
    ['src/app/(tabs)/dashboard/index.tsx', 'compactTitleInteractive'],
    ['src/features/home/components/RetailHome.tsx', 'compactTitleInteractive'],
    ['src/app/(tabs)/financeiro/index.tsx', 'compactTitle="Finanças"'],
    ['src/app/(tabs)/registrar/index.tsx', 'compactTitle="Registrar"'],
    [
      'src/features/retail-orders/components/RetailOrderRegistrarScreen.tsx',
      'compactTitle="Registrar"',
    ],
    ['src/features/history/components/HistoryScreen.tsx', 'compactTitle="Histórico"'],
    [
      'src/features/retail-orders/components/RetailOrderHistoryScreen.tsx',
      'compactTitle="Histórico"',
    ],
    ['src/features/settings/components/SettingsScreen.tsx', 'compactTitle="Configurações"'],
    ['src/features/home/components/HomeSearchScreen.tsx', 'compactTitle="Pesquisa"'],
  ])('migrates %s to the promoted shared pipeline', (path, compactTitleProp) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('ProgressiveCollapsibleScreen');
    expect(source).toContain(compactTitleProp);
  });

  it('retains the legacy PremiumScreen API for out-of-scope routes', () => {
    expect(premiumScreenSource).toContain('collapsibleTitle?: PremiumScreenCollapsibleTitle');
    expect(historyScreenSource).toContain('contentTopInset={insets.top - theme.spacing.xxs}');
  });

  it('uses the shared Stack pipeline for Daily Data and preserves delivery legacy fallback', () => {
    const registrarSource = readFileSync('src/app/(tabs)/registrar/index.tsx', 'utf8');
    const dailyDataSource = registrarSource.slice(
      registrarSource.indexOf('export function RegistrarDailyDataScreen'),
      registrarSource.indexOf('export function RegistrarDeliveryScreen'),
    );

    expect(dailyDataSource).toContain('<ProgressiveCollapsibleScreen');
    expect(dailyDataSource).toContain('compactTitle="Dados Diários"');
    expect(dailyDataSource).toContain('contentTopInset={originalContentTopOffset}');
    expect(dailyDataSource).toContain('contentGap={0}');
    expect(dailyDataSource).toContain('nativeHeader');
    expect(dailyDataSource).not.toContain('nativeTabRoot');
    expect(dailyDataSource).not.toContain('collapsibleTitle');
    expect(dailyDataSource).not.toContain('overlayHeader');
    expect(dailyDataSource).not.toContain('progressiveBlur');
    expect(dailyDataSource).not.toContain('<ScrollView');
    expect(dailyDataSource).toContain('marginBottom: theme.spacing.xs');
    expect(dailyDataSource).toContain('paddingHorizontal: theme.layout.screenHorizontalPadding');
    expect(dailyDataSource).toContain('paddingTop: theme.spacing.md');
    expect(dailyDataSource).toContain('const handleDailyDataSubmit');
    expect(dailyDataSource).toContain('onSubmit={handleDailyDataSubmit}');
    expect(dailyDataSource).toContain('const handleDeleteDailyData');
    expect(dailyDataSource).toContain('NativeCardContextMenu');
    expect(dailyDataSource).toContain("title: 'Excluir'");
    expect(dailyDataSource).toContain('void handleDeleteDailyData()');
    expect(dailyDataSource).toContain('label="Adicionar"');
    expect(dailyDataSource).toContain('onPress={openDailyDataSheet}');
    expect(dailyDataSource).toContain('<NativeDailyDataSheet');
    expect(dailyDataSource).toContain('onSubmit={handleDailyDataSubmit}');

    const deliverySource = registrarSource.slice(
      registrarSource.indexOf('export function RegistrarDeliveryScreen'),
    );
    expect(deliverySource).toContain(
      "collapsibleTitle={showLargeTitle ? { compactTitle: 'Entregas' } : undefined}",
    );
    expect(registrarSource).toContain("compactTitle: 'Entregas'");
    expect(registrarSource).toContain('compactTitle="Registrar"');
  });
});
