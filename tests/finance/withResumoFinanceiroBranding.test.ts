import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type WidgetDefinition = {
  name: string;
  displayName: string;
  description: string;
  ios: {
    supportedFamilies: string[];
    configuration?: { title: string; parameters: Record<string, never> };
  };
};

type GeneratedConfig = {
  mods: {
    ios: {
      dangerous: (
        config: GeneratedConfig & {
          modRequest: { platformProjectRoot: string };
        },
      ) => Promise<GeneratedConfig>;
    };
  };
  [key: string]: unknown;
};

const actualExpoWidgetsPackageRoot = path.resolve(process.cwd(), 'node_modules/expo-widgets');
const actualWidgetSourcePlugin = (
  jest.requireActual('expo-widgets/plugin/build/ios/withWidgetSourceFiles.js') as {
    default: (
      config: Record<string, unknown>,
      props: {
        targetName: string;
        groupIdentifier: string;
        widgets: WidgetDefinition[];
        onFilesGenerated: (files: string[]) => void;
      },
    ) => GeneratedConfig;
  }
).default;

const {
  transformExpoWidgetsTarget,
  transformExpoWidgetsUtilsSource,
  transformSharedWidgetEntryViewSource,
  transformConfigurableWidgetSource,
} = jest.requireActual('../../plugins/withResumoFinanceiroBranding') as {
  transformExpoWidgetsTarget: (projectRoot: string, packageRoot?: string) => void;
  transformExpoWidgetsUtilsSource: (source: string) => string;
  transformSharedWidgetEntryViewSource: (source: string) => string;
  transformConfigurableWidgetSource: (source: string, widgetName: string) => string;
};

const widgetDefinitions: WidgetDefinition[] = [
  {
    name: 'ResumoFinanceiro',
    displayName: 'Resumo Financeiro',
    description: 'Faturamento e lucro líquido do mês.',
    ios: {
      supportedFamilies: ['systemSmall', 'systemMedium'],
      configuration: { title: 'Modo Financeiro', parameters: {} },
    },
  },
  {
    name: 'EntregasDoDia',
    displayName: 'Entregas do Dia',
    description: 'Resumo das entregas de hoje.',
    ios: { supportedFamilies: ['systemSmall', 'systemMedium'] },
  },
];

let temporaryProjectRoot: string | undefined;

afterEach(() => {
  if (temporaryProjectRoot) {
    fs.rmSync(temporaryProjectRoot, { recursive: true, force: true });
    temporaryProjectRoot = undefined;
  }
});

function createTemporaryProject() {
  temporaryProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigatti-widget-branding-'));
  const iosRoot = path.join(temporaryProjectRoot, 'ios');
  const packageRoot = path.join(temporaryProjectRoot, 'node_modules', 'expo-widgets');
  const packageWidgetsRoot = path.join(packageRoot, 'ios', 'Widgets');
  fs.mkdirSync(iosRoot, { recursive: true });
  fs.mkdirSync(packageWidgetsRoot, { recursive: true });

  for (const fileName of [
    'package.json',
    'ios/Widgets/Utils.swift',
    'ios/Widgets/EntryView.swift',
    'ios/Widgets/TimelineProvider.swift',
  ]) {
    const sourcePath = path.join(actualExpoWidgetsPackageRoot, fileName);
    const destinationPath = path.join(packageRoot, fileName);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
  }

  return { iosRoot, packageRoot };
}

async function generateRealExpoWidgetsTarget(iosRoot: string) {
  const generatedConfig = actualWidgetSourcePlugin(
    {
      name: 'EmporioRigatti',
      slug: 'emporio-rigatti',
      version: '1.0.0',
      ios: { version: '1.0', buildNumber: '1' },
      mods: {},
    },
    {
      targetName: 'ExpoWidgetsTarget',
      groupIdentifier: 'group.com.pareact.mobile',
      widgets: widgetDefinitions,
      onFilesGenerated: () => undefined,
    },
  );

  await generatedConfig.mods.ios.dangerous({
    ...generatedConfig,
    modRequest: { platformProjectRoot: iosRoot },
  });

  return path.join(iosRoot, 'ExpoWidgetsTarget');
}

function extractWidgetEntryViewBody(source: string, viewStructAnchor: string) {
  const structStart = source.indexOf(viewStructAnchor);
  const bodyAnchor = '  public var body: some View {\n';
  const bodyStart = source.indexOf(bodyAnchor, structStart);
  const bodyContentsStart = bodyStart + bodyAnchor.length;
  const bodyEnd = source.indexOf('\n  }\n}', bodyContentsStart);

  expect(structStart).toBeGreaterThanOrEqual(0);
  expect(bodyStart).toBeGreaterThanOrEqual(structStart);
  expect(bodyEnd).toBeGreaterThan(bodyContentsStart);
  return source.slice(bodyContentsStart, bodyEnd);
}

describe('Expo Widgets iOS CNG transform', () => {
  it('adds App Group image resolution and idempotent runtime diagnostics to SDK 58 sources', async () => {
    const { iosRoot, packageRoot } = createTemporaryProject();
    const targetDirectory = await generateRealExpoWidgetsTarget(iosRoot);
    const financeSource = fs.readFileSync(
      path.join(targetDirectory, 'ResumoFinanceiro.swift'),
      'utf8',
    );
    const deliverySource = fs.readFileSync(
      path.join(targetDirectory, 'EntregasDoDia.swift'),
      'utf8',
    );
    const generatedInfoPlist = fs.readFileSync(path.join(targetDirectory, 'Info.plist'), 'utf8');
    const sharedEntryView = fs.readFileSync(
      path.join(packageRoot, 'ios/Widgets/EntryView.swift'),
      'utf8',
    );

    expect(financeSource).toContain('AppIntentConfiguration(');
    expect(financeSource).toContain('getWidgetEnvironment(environment: environment)');
    expect(deliverySource).toContain('StaticConfiguration(');
    expect(deliverySource).toContain('WidgetsEntryView(entry: entry)');
    expect(deliverySource).not.toContain('getWidgetEnvironment(environment: environment)');
    expect(generatedInfoPlist).toContain('<key>ExpoWidgetsAppGroupIdentifier</key>');
    expect(generatedInfoPlist).toContain('<string>group.com.pareact.mobile</string>');
    expect(sharedEntryView).toContain('getWidgetEnvironment(environment: environment)');

    transformExpoWidgetsTarget(iosRoot, packageRoot);
    const utilsPath = path.join(packageRoot, 'ios/Widgets/Utils.swift');
    const entryViewPath = path.join(packageRoot, 'ios/Widgets/EntryView.swift');
    const providerPath = path.join(packageRoot, 'ios/Widgets/TimelineProvider.swift');
    const financeWidgetPath = path.join(targetDirectory, 'ResumoFinanceiro.swift');
    const firstPass = fs.readFileSync(utilsPath, 'utf8');
    const firstPassEntryView = fs.readFileSync(entryViewPath, 'utf8');
    const firstPassProvider = fs.readFileSync(providerPath, 'utf8');
    const firstPassFinanceWidget = fs.readFileSync(financeWidgetPath, 'utf8');
    const firstPassDeliveryWidget = fs.readFileSync(
      path.join(targetDirectory, 'EntregasDoDia.swift'),
      'utf8',
    );
    const sharedEntryViewBody = extractWidgetEntryViewBody(
      firstPassEntryView,
      'public struct WidgetsEntryView: View {',
    );
    const financeWidgetViewBody = extractWidgetEntryViewBody(
      firstPassFinanceWidget,
      'struct ResumoFinanceiroEntryView: View {',
    );

    expect(firstPass).toContain('import Foundation');
    expect(firstPass).toContain('// ResumoFinanceiro shared branding image directory');
    expect(firstPass).toContain(
      'Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String',
    );
    expect(firstPass).toContain(
      'FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)',
    );
    expect(firstPass).toContain('env["widgetsDirectory"] =');
    expect(firstPass).toContain(
      'appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true)',
    );
    expect(firstPassEntryView).toContain('event=widget_extension_entry');
    expect(firstPassEntryView).toContain('import Foundation');
    expect(firstPassEntryView).toContain('import os');
    expect(firstPassEntryView).toContain('private let diagnosticsLogger = os.Logger(');
    expect(firstPassEntryView).toContain('event=layout_evaluation');
    expect(firstPassEntryView).toContain('event=empty_widget_view');
    expect(firstPassProvider).toContain('event=timeline_placeholder');
    expect(firstPassProvider).toContain('event=timeline_snapshot');
    expect(firstPassProvider).toContain('event=timeline_refresh');
    expect(firstPassEntryView).toContain('event=layout_lookup');
    expect(firstPassEntryView).toContain('source=\\(layoutSource, privacy: .public)');
    expect(firstPassEntryView).toContain('app_group_container=');
    expect(firstPassFinanceWidget).toContain(
      'event=widget_extension_entry widget=ResumoFinanceiro',
    );
    expect(firstPassFinanceWidget).toContain(
      'private let resumoFinanceiroWidgetDiagnosticsLogger = os.Logger(',
    );
    expect(firstPassFinanceWidget).toContain('event=empty_widget_view widget=ResumoFinanceiro');
    expect(firstPassFinanceWidget).toContain('event=layout_evaluation widget=ResumoFinanceiro');
    expect(firstPassFinanceWidget).toContain('event=timeline_placeholder widget=ResumoFinanceiro');
    expect(firstPassFinanceWidget).toContain('event=timeline_snapshot widget=ResumoFinanceiro');
    expect(firstPassFinanceWidget).toContain('event=timeline_refresh widget=ResumoFinanceiro');
    expect(sharedEntryViewBody).toContain('diagnosedLayoutView(layout: layout)');
    expect(sharedEntryViewBody).toContain('diagnosedEmptyWidgetView()');
    expect(sharedEntryViewBody).not.toMatch(/\.(info|error|debug|notice|warning)\(/);
    expect(financeWidgetViewBody).toContain('diagnosedLayoutView(layout: layout)');
    expect(financeWidgetViewBody).toContain('diagnosedEmptyWidgetView()');
    expect(financeWidgetViewBody).not.toMatch(/\.(info|error|debug|notice|warning)\(/);
    expect(firstPassEntryView).toContain(
      'private func diagnosedLayoutView(layout: String) -> some View',
    );
    expect(firstPassFinanceWidget).toContain(
      'private func diagnosedEmptyWidgetView() -> EmptyWidgetView',
    );
    expect(firstPassDeliveryWidget).toContain('StaticConfiguration(');
    expect(firstPassDeliveryWidget).toContain('WidgetsEntryView(entry: entry)');
    expect(firstPassDeliveryWidget).not.toContain('diagnosedLayoutView(layout: layout)');

    transformExpoWidgetsTarget(iosRoot, packageRoot);
    expect(fs.readFileSync(utilsPath, 'utf8')).toBe(firstPass);
    expect(fs.readFileSync(entryViewPath, 'utf8')).toBe(firstPassEntryView);
    expect(fs.readFileSync(providerPath, 'utf8')).toBe(firstPassProvider);
    expect(fs.readFileSync(financeWidgetPath, 'utf8')).toBe(firstPassFinanceWidget);
    expect(fs.readFileSync(path.join(targetDirectory, 'EntregasDoDia.swift'), 'utf8')).toBe(
      firstPassDeliveryWidget,
    );
  });

  it('moves legacy inline SwiftUI diagnostics into helper methods for both view variants', async () => {
    const { iosRoot, packageRoot } = createTemporaryProject();
    const targetDirectory = await generateRealExpoWidgetsTarget(iosRoot);
    const rawSharedEntryView = fs.readFileSync(
      path.join(packageRoot, 'ios/Widgets/EntryView.swift'),
      'utf8',
    );
    const rawFinanceWidget = fs.readFileSync(
      path.join(targetDirectory, 'ResumoFinanceiro.swift'),
      'utf8',
    );

    const legacySharedEntryView = rawSharedEntryView
      .replace(
        'public struct WidgetsEntryView: View {\n',
        'public struct WidgetsEntryView: View {\n' +
          '  // Rigatti WidgetKit runtime diagnostics\n' +
          '  private let diagnosticsLogger = os.Logger(subsystem: "com.pareact.mobile", category: "WidgetRenderDiagnostics")\n' +
          '  private func widgetDiagnosticsName(_ name: String) -> String { name }\n',
      )
      .replace(
        '    self.entry = entry\n',
        '    self.entry = entry\n' +
          '    diagnosticsLogger.info("event=widget_extension_entry widget=ResumoFinanceiro")\n',
      )
      .replace(
        '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n',
        '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n' +
          '      diagnosticsLogger.info("event=layout_lookup widget=ResumoFinanceiro")\n',
      );
    const migratedSharedEntryView = transformSharedWidgetEntryViewSource(legacySharedEntryView);
    const migratedSharedBody = extractWidgetEntryViewBody(
      migratedSharedEntryView,
      'public struct WidgetsEntryView: View {',
    );

    const legacyFinanceWidget = rawFinanceWidget
      .replace(
        'struct ResumoFinanceiroTimelineEntry: TimelineEntry {\n',
        '// Rigatti WidgetKit runtime diagnostics: ResumoFinanceiro\n' +
          'private let resumoFinanceiroWidgetDiagnosticsLogger = os.Logger(subsystem: "com.pareact.mobile", category: "WidgetRenderDiagnostics")\n\n' +
          'struct ResumoFinanceiroTimelineEntry: TimelineEntry {\n',
      )
      .replace(
        '    self.entry = entry\n',
        '    self.entry = entry\n' +
          '    resumoFinanceiroWidgetDiagnosticsLogger.info("event=widget_extension_entry widget=ResumoFinanceiro")\n',
      )
      .replace(
        '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n',
        '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n' +
          '      resumoFinanceiroWidgetDiagnosticsLogger.info("event=layout_lookup widget=ResumoFinanceiro")\n',
      );
    const migratedFinanceWidget = transformConfigurableWidgetSource(
      legacyFinanceWidget,
      'ResumoFinanceiro',
    );
    const migratedFinanceBody = extractWidgetEntryViewBody(
      migratedFinanceWidget,
      'struct ResumoFinanceiroEntryView: View {',
    );

    expect(migratedSharedBody).not.toMatch(/\.(info|error|debug|notice|warning)\(/);
    expect(migratedFinanceBody).not.toMatch(/\.(info|error|debug|notice|warning)\(/);
    expect(migratedSharedEntryView).toContain('event=layout_evaluation');
    expect(migratedSharedEntryView).toContain('event=empty_widget_view');
    expect(migratedFinanceWidget).toContain('event=layout_evaluation widget=ResumoFinanceiro');
    expect(migratedFinanceWidget).toContain('event=empty_widget_view widget=ResumoFinanceiro');
    expect(migratedFinanceWidget).toContain('event=timeline_placeholder widget=ResumoFinanceiro');
    expect(migratedFinanceWidget).toContain('event=timeline_snapshot widget=ResumoFinanceiro');
    expect(migratedFinanceWidget).toContain('event=timeline_refresh widget=ResumoFinanceiro');
  });

  it('transforms the actual installed Utils.swift template without changing its line ending style', () => {
    const actualUtilsSource = fs.readFileSync(
      path.join(actualExpoWidgetsPackageRoot, 'ios/Widgets/Utils.swift'),
      'utf8',
    );

    const transformed = transformExpoWidgetsUtilsSource(actualUtilsSource);
    expect(transformed).toContain('env["widgetsDirectory"] =');
    expect(transformExpoWidgetsUtilsSource(transformed)).toBe(transformed);

    const windowsSource = actualUtilsSource.replace(/\n/g, '\r\n');
    const windowsTransformed = transformExpoWidgetsUtilsSource(windowsSource);
    expect(windowsTransformed).toContain('\r\n');
    expect(windowsTransformed.replace(/\r\n/g, '')).not.toContain('\n');
    expect(transformExpoWidgetsUtilsSource(windowsTransformed)).toBe(windowsTransformed);
  });

  it('fails clearly when an expected generated widget source is missing', async () => {
    const { iosRoot, packageRoot } = createTemporaryProject();
    const targetDirectory = await generateRealExpoWidgetsTarget(iosRoot);
    fs.rmSync(path.join(targetDirectory, 'EntregasDoDia.swift'));

    expect(() => transformExpoWidgetsTarget(iosRoot, packageRoot)).toThrow(
      'could not find EntregasDoDia.swift',
    );
  });

  it('fails clearly when the static widget no longer uses the shared entry view', async () => {
    const { iosRoot, packageRoot } = createTemporaryProject();
    const targetDirectory = await generateRealExpoWidgetsTarget(iosRoot);
    const deliverySourcePath = path.join(targetDirectory, 'EntregasDoDia.swift');
    const deliverySource = fs
      .readFileSync(deliverySourcePath, 'utf8')
      .replace('WidgetsEntryView(entry: entry)', 'UnexpectedEntryView(entry: entry)');
    fs.writeFileSync(deliverySourcePath, deliverySource);

    expect(() => transformExpoWidgetsTarget(iosRoot, packageRoot)).toThrow(
      'expected exactly one EntregasDoDia shared entry view; found 0',
    );
  });

  it('fails clearly when the shared environment helper insertion point is absent', () => {
    const actualUtilsSource = fs.readFileSync(
      path.join(actualExpoWidgetsPackageRoot, 'ios/Widgets/Utils.swift'),
      'utf8',
    );

    expect(() =>
      transformExpoWidgetsUtilsSource(
        actualUtilsSource.replace(
          'public func getWidgetEnvironment',
          'public func changedWidgetEnvironment',
        ),
      ),
    ).toThrow(
      'expected exactly one getWidgetEnvironment helper; check the installed Expo Widgets source',
    );
  });

  it('rejects a partial marker instead of silently accepting a broken injection', () => {
    const actualUtilsSource = fs.readFileSync(
      path.join(actualExpoWidgetsPackageRoot, 'ios/Widgets/Utils.swift'),
      'utf8',
    );
    const partialSource = actualUtilsSource.replace(
      'public func getWidgetEnvironment',
      '// ResumoFinanceiro shared branding image directory\npublic func getWidgetEnvironment',
    );

    expect(() => transformExpoWidgetsUtilsSource(partialSource)).toThrow(
      'found a partial or duplicated shared image path marker',
    );
  });
});
