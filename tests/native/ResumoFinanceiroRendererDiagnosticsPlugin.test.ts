import fs from 'node:fs';
import path from 'node:path';

const { assertPackageVersion, transformDynamicViewSource, transformImageViewSource } =
  jest.requireActual<{
    assertPackageVersion: (filePath: string, packageName: string, expected: string) => void;
    transformDynamicViewSource: (source: string) => string;
    transformImageViewSource: (source: string) => string;
  }>('../../plugins/withResumoFinanceiroRendererDiagnostics');

const repoRoot = path.resolve(__dirname, '../..');
const dynamicViewSource = fs.readFileSync(
  path.join(repoRoot, 'node_modules/expo-widgets/ios/Widgets/DynamicView.swift'),
  'utf8',
);
const imageViewSource = fs.readFileSync(
  path.join(repoRoot, 'node_modules/@expo/ui/ios/ImageView.swift'),
  'utf8',
);
const widgetDiagnosticsModuleSource = fs.readFileSync(
  path.join(repoRoot, 'modules/native-widget-diagnostics/ios/NativeWidgetDiagnosticsModule.swift'),
  'utf8',
);

describe('ResumoFinanceiro renderer diagnostics CNG plugin', () => {
  it('instruments only this widget renderer, child redaction, failures and host lifecycle', () => {
    const instrumented = transformDynamicViewSource(dynamicViewSource);

    expect(instrumented).toContain('category: "RigattiWidgetSync"');
    expect(instrumented).toContain('import os');
    expect(instrumented).not.toContain('import OSLog');
    expect(instrumented).toContain('resumoFinanceiroRendererLogger = os.Logger(');
    expect(instrumented).toContain('logger: os.Logger');
    expect(instrumented).not.toMatch(/(?:=|:\s*)Logger\b/);
    expect(instrumented).toContain('event=renderer_enter');
    expect(instrumented).toContain('stage=missing_props');
    expect(instrumented).toContain('stage=props_decode');
    expect(instrumented).toContain('stage=children_attach');
    expect(instrumented).toContain('stage=host_constructed');
    expect(instrumented).toContain('event=renderer_appeared');
    expect(instrumented).toContain('event=renderer_redaction_node');
    expect(instrumented).toContain('widgetRedactionReasons.contains(.placeholder)');
    expect(instrumented).toContain('widgetRedactionReasons.contains(.privacy)');
    expect(instrumented).toContain('stage=unsupported_node');
    expect(instrumented).toContain('guard isResumoFinanceiroDiagnostic(name, kind) else');
    expect(instrumented).toContain('fallback=empty_view');
    expect(instrumented).toContain('stage=host_constructed');
    expect(instrumented).toContain('NSURLErrorDomain');
    expect(instrumented).not.toContain('localizedDescription');
    expect(instrumented).not.toContain('print(error)');
    expect(transformDynamicViewSource(instrumented)).toBe(instrumented);
  });

  it('rejects older renderer instrumentation rather than accepting stale coverage', () => {
    const instrumented = transformDynamicViewSource(dynamicViewSource);
    const legacyInstrumented = instrumented.replace(
      '// TEMPORARY ResumoFinanceiro renderer diagnostics v3',
      '// TEMPORARY ResumoFinanceiro renderer diagnostics',
    );

    expect(() => transformDynamicViewSource(legacyInstrumented)).toThrow(
      'found legacy DynamicView instrumentation',
    );
  });

  it('migrates cached v2 DynamicView output to qualified Logger types', () => {
    const instrumented = transformDynamicViewSource(dynamicViewSource);
    const staleV2 = instrumented
      .replace(
        '// TEMPORARY ResumoFinanceiro renderer diagnostics v3',
        '// TEMPORARY ResumoFinanceiro renderer diagnostics v2',
      )
      .replace('import os\n', 'import OSLog\n')
      .replace('os.Logger(', 'Logger(')
      .replace('logger: os.Logger', 'logger: Logger');

    const migrated = transformDynamicViewSource(staleV2);

    expect(migrated).toContain('ResumoFinanceiro renderer diagnostics v3');
    expect(migrated).toContain('import os');
    expect(migrated).toContain('resumoFinanceiroRendererLogger = os.Logger(');
    expect(migrated).toContain('logger: os.Logger');
    expect(migrated).not.toMatch(/(?:=|:\s*)Logger\b/);
    expect(transformDynamicViewSource(migrated)).toBe(migrated);
  });

  it('instruments image loading with dimensions and byte count without recording the image path', () => {
    const instrumented = transformImageViewSource(imageViewSource);

    expect(instrumented).toContain('event=image_load_start');
    expect(instrumented).toContain('import os');
    expect(instrumented).not.toContain('import OSLog');
    expect(instrumented).toContain('imageDiagnosticsLogger = os.Logger(');
    expect(instrumented).not.toMatch(/(?:=|:\s*)Logger\b/);
    expect(instrumented).toContain('event=image_load_result success=true');
    expect(instrumented).toContain('event=image_load_failure stage=decode');
    expect(instrumented).toContain('Bundle.main.bundleURL.pathExtension == "appex"');
    expect(instrumented).toContain('event=image_load_failure stage=read error_type=');
    expect(instrumented).toContain('pixel_width=');
    expect(instrumented).toContain('pixel_height=');
    expect(instrumented).toContain('bytes=');
    expect(instrumented).toContain('rgba_estimate_bytes=');
    expect(instrumented).not.toContain('source, privacy:');
    expect(instrumented).not.toContain('props.uiImage, privacy:');
    expect(transformImageViewSource(instrumented)).toBe(instrumented);
  });

  it('migrates cached v2 ImageView output to a qualified Logger', () => {
    const instrumented = transformImageViewSource(imageViewSource);
    const staleV2 = instrumented
      .replace(
        '// TEMPORARY ResumoFinanceiro image loading diagnostics v3',
        '// TEMPORARY ResumoFinanceiro image loading diagnostics v2',
      )
      .replace('import os\n', 'import OSLog\n')
      .replace('os.Logger(', 'Logger(');

    const migrated = transformImageViewSource(staleV2);

    expect(migrated).toContain('ResumoFinanceiro image loading diagnostics v3');
    expect(migrated).toContain('import os');
    expect(migrated).toContain('imageDiagnosticsLogger = os.Logger(');
    expect(migrated).not.toMatch(/(?:=|:\s*)Logger\b/);
    expect(transformImageViewSource(migrated)).toBe(migrated);
  });

  it('keeps the app-owned widget diagnostics module explicitly qualified', () => {
    expect(widgetDiagnosticsModuleSource).toContain('private let logger = os.Logger(');
    expect(widgetDiagnosticsModuleSource).not.toMatch(/(?:=|:\s*)Logger\b/);
  });

  it('rejects older image instrumentation rather than retaining missing asset diagnostics', () => {
    const instrumented = transformImageViewSource(imageViewSource);
    const legacyInstrumented = instrumented.replace(
      '// TEMPORARY ResumoFinanceiro image loading diagnostics v3',
      '// TEMPORARY ResumoFinanceiro image loading diagnostics',
    );

    expect(() => transformImageViewSource(legacyInstrumented)).toThrow(
      'found legacy ImageView instrumentation',
    );
  });

  it('fails clearly if the installed Expo renderer structure changes', () => {
    const changed = dynamicViewSource.replace(
      'private func render<P, V>',
      'private func renderChanged<P, V>',
    );

    expect(() => transformDynamicViewSource(changed)).toThrow(
      'could not locate the unique DynamicView.render method',
    );
  });

  it('requires the package versions audited for this temporary patch', () => {
    const packageJson = path.join(repoRoot, 'node_modules/expo-widgets/package.json');

    expect(() => assertPackageVersion(packageJson, 'expo-widgets', '57.0.22')).not.toThrow();
    expect(() => assertPackageVersion(packageJson, 'expo-widgets', '57.0.21')).toThrow(
      'requires expo-widgets@57.0.21',
    );

    const expoUiPackageJson = path.join(repoRoot, 'node_modules/@expo/ui/package.json');
    expect(() => assertPackageVersion(expoUiPackageJson, '@expo/ui', '57.0.21')).not.toThrow();
    expect(() => assertPackageVersion(expoUiPackageJson, '@expo/ui', '57.0.22')).toThrow(
      'requires @expo/ui@57.0.22',
    );
  });
});
