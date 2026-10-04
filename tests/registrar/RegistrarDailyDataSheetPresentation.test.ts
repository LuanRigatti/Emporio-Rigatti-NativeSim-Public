import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  APPROVED_DARK_SHEET_GLASS_TINT,
  APPROVED_LIGHT_SHEET_GLASS_TINT,
} from '@/theme/sheetGlassTints';

const registrarScreenSource = readFileSync(
  resolve(process.cwd(), 'src/app/(tabs)/registrar/index.tsx'),
  'utf8',
);
const dailyDataSheetSource = readFileSync(
  resolve(
    process.cwd(),
    'src/components/native/NativeDailyDataSheet/NativeDailyDataSheetSwiftUI.ios.tsx',
  ),
  'utf8',
);
const dailyDataFallbackSource = readFileSync(
  resolve(
    process.cwd(),
    'src/components/native/NativeDailyDataSheet/NativeDailyDataSheetFallback.tsx',
  ),
  'utf8',
);
const dailyDataTypesSource = readFileSync(
  resolve(
    process.cwd(),
    'src/components/native/NativeDailyDataSheet/NativeDailyDataSheet.types.ts',
  ),
  'utf8',
);

describe('Registrar daily data sheet presentation', () => {
  it('preserves per-mode native Glass tint and modal dimming only for this consumer', () => {
    const dailySheetProps = registrarScreenSource.match(
      /<NativeDailyDataSheet\b([\s\S]*?)\/>/,
    )?.[1];

    expect(dailySheetProps).toBeDefined();
    expect(dailySheetProps).not.toMatch(/\bpresentationBackgroundColor\s*=/);
    expect(dailySheetProps).toContain('presentationBackgroundInteraction="disabled"');
    expect(dailySheetProps).toContain('presentationBackgroundMode="native"');
    expect(dailySheetProps).toContain('glassSurface');
    expect(dailySheetProps).toMatch(
      /glassTint=\{\s*resolvedMode === 'dark'\s*\? APPROVED_DARK_SHEET_GLASS_TINT\s*:\s*APPROVED_LIGHT_SHEET_GLASS_TINT\s*\}/,
    );
    expect(dailyDataSheetSource).toContain('interactive: true');
    expect(dailyDataSheetSource).toContain("variant: 'regular'");
    expect(APPROVED_LIGHT_SHEET_GLASS_TINT).toBe('rgba(242, 244, 245, 0.85)');
    expect(APPROVED_DARK_SHEET_GLASS_TINT).toBe('rgba(28, 28, 30, 0.82)');
    expect(dailyDataSheetSource).toContain("label: 'Estar'");
    expect(dailyDataSheetSource).toContain("label: 'Outros'");
    expect(dailyDataSheetSource).toContain("label: 'Km'");
    expect(dailyDataSheetSource).toContain("label: 'Combustível'");
    expect(dailyDataSheetSource).toContain('const listPage = (');
    expect(dailyDataSheetSource).toContain('const detailPage = (');
    expect(dailyDataSheetSource).toContain('const pagerContent = (');
    expect(dailyDataSheetSource).toContain('await onSubmit(values)');
    expect(dailyDataSheetSource).toContain('Adicionar');
  });

  it('keeps enabled as the shared default and applies explicit background options natively', () => {
    expect(dailyDataTypesSource).toContain('presentationBackgroundColor?: string;');
    expect(dailyDataTypesSource).toContain(
      'presentationBackgroundInteraction?: NativeSheetBackgroundInteraction;',
    );
    expect(dailyDataSheetSource).toMatch(
      /presentationBackgroundInteraction:\s*backgroundInteraction\s*=\s*'enabled'/,
    );
    expect(dailyDataSheetSource).toMatch(
      /setPresentationBackgroundInteraction\(backgroundInteraction\)/,
    );
    expect(dailyDataSheetSource).toMatch(
      /presentationBackgroundColor\s*\?\s*presentationBackground\(presentationBackgroundColor\)/,
    );
    expect(dailyDataSheetSource).toMatch(/presentationDetents\(\[\{ fraction: 0\.46 \}\]\)/);
    expect(dailyDataSheetSource).toContain("presentationDragIndicator('visible')");
  });

  it('preserves internal Glass and forwards the opt-in options through the fallback', () => {
    const detailHeader = dailyDataSheetSource.match(
      /const detailHeader = \(([\s\S]*?)\n\s*const detailPage =/,
    )?.[1];

    expect(detailHeader).toContain('glassEffect(');
    expect(dailyDataFallbackSource).toContain('presentationBackgroundColor,');
    expect(dailyDataFallbackSource).toContain('presentationBackgroundInteraction,');
    expect(dailyDataFallbackSource).toContain(
      '<NativeSheet\n      onVisibleChange={onVisibleChange}\n      presentationBackgroundColor={presentationBackgroundColor}\n      presentationBackgroundInteraction={presentationBackgroundInteraction}',
    );
  });
});
