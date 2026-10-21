import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const actualExpoWidgetsPackageRoot = path.resolve(process.cwd(), 'node_modules/expo-widgets');
const { transformExpoWidgetsTarget, transformExpoWidgetsUtilsSource } = jest.requireActual(
  '../../plugins/withResumoFinanceiroBranding',
) as {
  transformExpoWidgetsTarget: (projectRoot: string, packageRoot?: string) => void;
  transformExpoWidgetsUtilsSource: (source: string) => string;
};

describe('Expo Widgets branding CNG transform', () => {
  it('adds the shared App Group image directory idempotently and preserves line endings', () => {
    const source = fs.readFileSync(
      path.join(actualExpoWidgetsPackageRoot, 'ios/Widgets/Utils.swift'),
      'utf8',
    );

    const transformed = transformExpoWidgetsUtilsSource(source);
    expect(transformed).toContain('env["widgetsDirectory"] =');
    expect(transformed).toContain('// Rigatti Live Activity shared branding image directory');
    const liveActivityStart = transformed.indexOf('func getLiveActivityEnvironment(');
    const liveActivityEnd = transformed.indexOf('  return env', liveActivityStart);
    const liveActivityEnvironment = transformed.slice(liveActivityStart, liveActivityEnd);
    expect(liveActivityEnvironment).toContain('env["widgetsDirectory"] =');
    expect(liveActivityEnvironment).toContain(
      'appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    );
    expect(transformExpoWidgetsUtilsSource(transformed)).toBe(transformed);

    const windowsSource = source.replace(/\n/g, '\r\n');
    const windowsTransformed = transformExpoWidgetsUtilsSource(windowsSource);
    expect(windowsTransformed).toContain('\r\n');
    expect(windowsTransformed.replace(/\r\n/g, '')).not.toContain('\n');
    expect(transformExpoWidgetsUtilsSource(windowsTransformed)).toBe(windowsTransformed);
  });

  it('leaves generated widget and timeline Swift free of runtime instrumentation', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigatti-widget-branding-'));
    const packageRoot = path.join(temporaryRoot, 'node_modules', 'expo-widgets');
    const unchangedGeneratedFiles = ['ios/Widgets/EntryView.swift', 'ios/WidgetObject.swift'];
    const timelineProviderPath = 'ios/Widgets/TimelineProvider.swift';

    try {
      fs.mkdirSync(path.join(packageRoot, 'ios/Widgets'), { recursive: true });
      for (const relativePath of [
        'package.json',
        'ios/Widgets/Utils.swift',
        timelineProviderPath,
        ...unchangedGeneratedFiles,
      ]) {
        const sourcePath = path.join(actualExpoWidgetsPackageRoot, relativePath);
        const destinationPath = path.join(packageRoot, relativePath);
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
      }
      const generatedBefore = unchangedGeneratedFiles.map((relativePath) =>
        fs.readFileSync(path.join(packageRoot, relativePath), 'utf8'),
      );

      transformExpoWidgetsTarget(path.join(temporaryRoot, 'ios'), packageRoot);

      expect(
        unchangedGeneratedFiles.map((relativePath) =>
          fs.readFileSync(path.join(packageRoot, relativePath), 'utf8'),
        ),
      ).toEqual(generatedBefore);
      const timelineProvider = fs.readFileSync(
        path.join(packageRoot, timelineProviderPath),
        'utf8',
      );
      expect(timelineProvider).toContain('category: "WidgetOperationalErrors"');
      expect(timelineProvider).toContain(
        'operationalErrorLogger.error("event=widget_app_group_identifier_missing")',
      );
      expect(timelineProvider).not.toMatch(/WidgetRenderDiagnostics|\.info\(|\.debug\(/);
      expect(fs.readFileSync(path.join(packageRoot, 'ios/Widgets/Utils.swift'), 'utf8')).toContain(
        'env["widgetsDirectory"] =',
      );
      const utils = fs.readFileSync(path.join(packageRoot, 'ios/Widgets/Utils.swift'), 'utf8');
      const liveActivityStart = utils.indexOf('func getLiveActivityEnvironment(');
      const liveActivityEnd = utils.indexOf('  return env', liveActivityStart);
      expect(utils.slice(liveActivityStart, liveActivityEnd)).toContain(
        '// Rigatti Live Activity shared branding image directory',
      );
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('rejects an unmarked or partial App Group image path', () => {
    const source = fs.readFileSync(
      path.join(actualExpoWidgetsPackageRoot, 'ios/Widgets/Utils.swift'),
      'utf8',
    );

    expect(() =>
      transformExpoWidgetsUtilsSource(
        source.replace('public func getWidgetEnvironment', 'public func changedWidgetEnvironment'),
      ),
    ).toThrow('expected exactly one getWidgetEnvironment helper');
    expect(() =>
      transformExpoWidgetsUtilsSource(
        source.replace(
          'public func getWidgetEnvironment',
          '// ResumoFinanceiro shared branding image directory\npublic func getWidgetEnvironment',
        ),
      ),
    ).toThrow('found a partial or duplicated shared image path marker');
  });

  it('rejects an unmarked or partial Live Activity image path', () => {
    const source = fs.readFileSync(
      path.join(actualExpoWidgetsPackageRoot, 'ios/Widgets/Utils.swift'),
      'utf8',
    );
    const transformed = transformExpoWidgetsUtilsSource(source);
    const liveActivityImagePath =
      'env["widgetsDirectory"] = appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString';

    expect(() =>
      transformExpoWidgetsUtilsSource(
        transformed.replace('// Rigatti Live Activity shared branding image directory\n', ''),
      ),
    ).toThrow('found an unmarked Live Activity widgetsDirectory assignment');
    const liveActivityPathIndex = transformed.lastIndexOf(liveActivityImagePath);
    const partialLiveActivitySource =
      transformed.slice(0, liveActivityPathIndex) +
      'env["widgetsDirectory"] = "file:///invalid"' +
      transformed.slice(liveActivityPathIndex + liveActivityImagePath.length);
    expect(() => transformExpoWidgetsUtilsSource(partialLiveActivitySource)).toThrow(
      'found a partial or duplicated Live Activity image path marker',
    );
  });
});
