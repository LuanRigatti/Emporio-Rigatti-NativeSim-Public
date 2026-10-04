import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const selectorSource = readSource(
  'src/components/native/NativeRetailFinanceCategorySelector/NativeRetailFinanceCategorySelectorSwiftUI.ios.tsx',
);
const selectorTypeSource = readSource(
  'src/components/native/NativeRetailFinanceCategorySelector/NativeRetailFinanceCategorySelector.types.ts',
);
const financeRouteSource = readSource('src/app/(tabs)/financeiro/index.tsx');
const selectorFallbackSource = readSource(
  'src/components/native/NativeRetailFinanceCategorySelector/NativeRetailFinanceCategorySelectorFallback.tsx',
);

function sectionBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Could not find source section between "${start}" and "${end}".`);
  }

  return source.slice(startIndex, endIndex);
}

describe('Finance selector selection animation composition', () => {
  const wholesaleIndicatorRow = sectionBetween(
    selectorSource,
    'const wholesaleSelectionIndicatorRow =',
    'const retailSelectionIndicatorRow =',
  );
  const retailIndicatorRow = sectionBetween(
    selectorSource,
    'const retailSelectionIndicatorRow =',
    'const selectionIndicatorRow =',
  );
  const nativeSelectionContent = sectionBetween(
    selectorSource,
    'const nativeSelectionContent =',
    'const content = usesSlidingBubble',
  );
  const labelRow = sectionBetween(
    selectorSource,
    'const labelButtonRow =',
    'const slidingBubbleContent =',
  );

  it('gives every mapped selector child a stable key', () => {
    expect(selectorSource.match(/items\.map\(/g)).toHaveLength(3);
    expect(retailIndicatorRow).toMatch(
      /items\.map\(\(item\) => \{[\s\S]*?<Group key=\{item\.key\}>/,
    );
    expect(labelRow).toMatch(/items\.map\(\(item\) => \{[\s\S]*?<Button\s+key=\{item\.key\}/);
    expect(labelRow).toContain('<HStack key={item.key}');
    expect(nativeSelectionContent).toMatch(/items\.map\(\(item\) => \{[\s\S]*?key=\{item\.key\}/);
    expect(selectorSource).not.toContain('(item, index)');
    expect(selectorFallbackSource).toMatch(/items\.map\(\(item\) => \{[\s\S]*?key=\{item\.key\}/);
  });

  it('keeps the single Wholesale capsule behind a separate, persistent label row', () => {
    const content = sectionBetween(
      selectorSource,
      'const slidingBubbleContent =',
      'const nativeSelectionContent =',
    );

    expect(content).toMatch(
      /<ZStack alignment="center">\s*\{selectionIndicatorRow\}\s*\{labelButtonRow\}\s*<\/ZStack>/,
    );
    expect(selectorSource).toContain('zIndex(layer)');
    expect(wholesaleIndicatorRow).toContain('rowModifiers(0)');
    expect(wholesaleIndicatorRow.match(/<Capsule\b/g)).toHaveLength(1);
    expect(selectorSource.match(/<Capsule\b/g)).toHaveLength(1);
    expect(wholesaleIndicatorRow).toContain('key="finance-selector-wholesale-selection-bubble"');
    expect(wholesaleIndicatorRow).not.toContain('selectedKey');
    expect(wholesaleIndicatorRow).not.toContain('selected ?');
    expect(wholesaleIndicatorRow).not.toContain('matchedGeometryEffect');
    expect(wholesaleIndicatorRow).toContain('animation(selectionAnimation, selectedIndex)');
    expect(labelRow).toContain('rowModifiers(1)');
    expect(labelRow).toContain('<Button');
    expect(labelRow).toContain('items.map((item) =>');
    expect(labelRow).not.toContain('matchedGeometryEffect');
    expect(labelRow).not.toContain('opacity(0)');
    expect(labelRow).not.toContain('animation(');
    expect(labelRow).not.toContain('scaleEffect(');
  });

  it('uses equal actual container-relative slots and changes only the Wholesale capsule position', () => {
    const segmentFrames = sectionBetween(
      selectorSource,
      'const segmentFrameModifiers =',
      'const rowModifiers =',
    );
    const capsule = sectionBetween(wholesaleIndicatorRow, '<Capsule', '/>');

    expect(segmentFrames).toContain('count: items.length');
    expect(segmentFrames).toContain('span,');
    expect(segmentFrames).toContain('spacing: 0');
    expect(segmentFrames).not.toContain('scrollable ?');
    expect(segmentFrames).not.toContain('frame({ maxWidth: Infinity })');
    expect(wholesaleIndicatorRow).toContain('segmentFrameModifiers(selectedIndex)');
    expect(capsule).toContain('segmentFrameModifiers(1)');
    expect(capsule).toContain('frame({ height: 46 })');
    expect(capsule).not.toContain('selectedIndex');
    expect(capsule).not.toContain('matchedGeometryEffect');
    expect(capsule).not.toContain('scaleEffect(');
    expect(capsule).not.toContain('opacity(');
    expect(wholesaleIndicatorRow).toContain('animation(selectionAnimation, selectedIndex)');
  });

  it('keeps Retail horizontal scroll and moves its selected anchor through stable MGE identities', () => {
    expect(retailIndicatorRow).toContain('items.map((item) =>');
    expect(retailIndicatorRow).toContain('key={`${item.key}-selected-anchor`}');
    expect(retailIndicatorRow).toContain('key={`${item.key}-layout-anchor`}');
    expect(retailIndicatorRow).toContain('matchedGeometryEffect');
    expect(retailIndicatorRow).toContain('animation(selectionAnimation, selectedIndex)');
    expect(retailIndicatorRow).not.toContain('fillAvailableWidth');
    expect(selectorSource).toContain("defaultScrollAnchorForRole('center', 'alignment')");
  });

  it('keeps all visible labels stable and excludes selection scaling', () => {
    expect(labelRow).toContain(
      'foregroundStyle(selected ? theme.colors.textPrimary : theme.colors.textSecondary)',
    );
    expect(labelRow).not.toContain('matchedGeometryEffect');
    expect(labelRow).not.toContain('opacity(');
    expect(labelRow).not.toContain('scaleEffect(');
    expect(selectorSource).not.toContain('selectedVisualScale');
    expect(selectorSource).not.toContain('scaleEffect(');
    expect(selectorTypeSource).not.toContain('selectedVisualScale');
    expect(selectorFallbackSource).not.toContain('selectedVisualScale');
    expect(financeRouteSource).not.toContain('selectedVisualScale');
    expect(selectorSource).not.toContain('Animation.spring');
  });

  it('preserves Retail selector wiring and Reduce Motion timing', () => {
    const wholesaleSelector = sectionBetween(
      financeRouteSource,
      '<NativeRetailFinanceCategorySelector\n          accessibilityLabel="Período financeiro do Atacado"',
      '\n        />',
    );
    const retailSelector = sectionBetween(
      financeRouteSource,
      '<NativeRetailFinanceCategorySelector\n          accessibilityLabel="Visão financeira do Varejo"',
      '\n        />',
    );

    expect(selectorSource).toContain('scrollable = true');
    expect(retailSelector).toContain('items={financeViews}');
    expect(retailSelector).toContain('selectedKey={view}');
    expect(retailSelector).toContain(
      'onChange={(nextView) => setView(nextView as RetailFinanceView)}',
    );
    expect(retailSelector).not.toContain('fillAvailableWidth');
    expect(selectorSource).toContain('Animation.easeInOut({ duration: 0.22 })');
    expect(selectorSource).toContain('Animation.easeOut({ duration: 0.18 })');
    expect(selectorSource).toContain('reduceMotionEnabled');
    expect(selectorSource).toContain('<Host ignoreSafeArea="all"');
    expect(wholesaleSelector).toContain('selectionAnimationMode="slidingBubble"');
    expect(retailSelector).toContain('selectionAnimationMode="slidingBubble"');
  });
});
