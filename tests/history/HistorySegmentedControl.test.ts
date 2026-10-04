import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('History segmented control composition', () => {
  it('uses the Finance selector for the three fixed History modes', () => {
    const source = readSource('src/features/history/components/HistoryScreen.tsx');

    expect(source).toContain('NativeRetailFinanceCategorySelector');
    expect(source).toContain("{ key: 'day', label: 'Dia' }");
    expect(source).toContain("{ key: 'week', label: 'Semana' }");
    expect(source).toContain("{ key: 'month', label: 'Mês' }");
    expect(source).toContain('scrollable={false}');
    expect(source).toContain('selectionAnimationMode="slidingBubble"');
    expect(source).toContain('selectedKey={viewMode}');
    expect(source).toContain('onChange={handleSelectViewMode}');
  });

  it('keeps Retail History on its separate native segmented control', () => {
    const retailHistorySource = readSource(
      'src/features/retail-orders/components/RetailOrderHistoryScreen.tsx',
    );

    expect(retailHistorySource).toContain('<NativeSegmentedControl');
    expect(retailHistorySource).not.toContain('NativeRetailFinanceCategorySelector');
  });

  it('keeps horizontal scrolling as the default and omits it for the fixed native layout', () => {
    const nativeSource = readSource(
      'src/components/native/NativeRetailFinanceCategorySelector/NativeRetailFinanceCategorySelectorSwiftUI.ios.tsx',
    );
    const fallbackSource = readSource(
      'src/components/native/NativeRetailFinanceCategorySelector/NativeRetailFinanceCategorySelectorFallback.tsx',
    );

    expect(nativeSource).toContain('scrollable = true');
    expect(nativeSource).toContain("selectionAnimationMode = 'native'");
    expect(nativeSource).toContain(
      "resolvedMode === 'dark' ? darkModeCardSurface : theme.colors.surface",
    );
    expect(nativeSource).toContain(
      "resolvedMode === 'dark' ? darkModeInsetSurface : theme.colors.background",
    );
    expect(nativeSource).toMatch(
      /const selectorContent = scrollable \? \([\s\S]*?<ScrollView[\s\S]*?\) : \([\s\S]*?contentView[\s\S]*?\);/,
    );
    const segmentFrames = nativeSource.slice(
      nativeSource.indexOf('const segmentFrameModifiers ='),
      nativeSource.indexOf('const rowModifiers ='),
    );
    expect(segmentFrames).toContain('containerRelativeFrame({');
    expect(segmentFrames).toContain('count: items.length');
    expect(segmentFrames).not.toContain('scrollable ?');
    expect(segmentFrames).not.toContain('frame({ maxWidth: Infinity })');
    const nativeSelectionContent = nativeSource.slice(
      nativeSource.indexOf('const nativeSelectionContent ='),
      nativeSource.indexOf('const content = usesSlidingBubble'),
    );
    expect(nativeSelectionContent).toContain('background(selectedSurface, shapes.capsule())');
    expect(nativeSelectionContent).not.toContain('matchedGeometryEffect');
    expect(nativeSelectionContent).not.toContain('animation(');
    expect(fallbackSource).toContain('scrollable = true');
    expect(fallbackSource).toContain('<View style={contentStyle}>{options}</View>');
  });
});
