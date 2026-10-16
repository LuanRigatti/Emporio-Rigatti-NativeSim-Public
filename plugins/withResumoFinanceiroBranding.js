const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const EXPO_WIDGETS_VERSION = '58.0.19';
const WIDGET_SOURCE_NAMES = ['ResumoFinanceiro.swift', 'EntregasDoDia.swift'];
const BRANDING_MARKER = '// ResumoFinanceiro shared branding image directory';
const RUNTIME_DIAGNOSTICS_MARKER = '// Rigatti WidgetKit runtime diagnostics';
const ENVIRONMENT_HELPER_ANCHOR =
  'public func getWidgetEnvironment(environment: EnvironmentValues) -> [String: Any] {';
const ENVIRONMENT_INSERTION_ANCHOR = '  if #available(iOS 17.0, *) {';
const SHARED_ENTRY_VIEW_ANCHOR =
  '    var env: [String: Any] = getWidgetEnvironment(environment: environment)';

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const matches = countOccurrences(source, anchor);
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one ' +
        label +
        ' insertion point; found ' +
        matches +
        '. Check the expo-widgets@' +
        EXPO_WIDGETS_VERSION +
        ' generated Swift before building.',
    );
  }

  return source.replace(anchor, replacement);
}

function ensureFoundationImport(source) {
  const count = countOccurrences(source, 'import Foundation\n');
  if (count === 1) return source;
  if (count > 1) {
    throw new Error('ResumoFinanceiro branding CNG plugin found duplicate Foundation imports.');
  }

  const importAnchor = 'import SwiftUI\n';
  return replaceExactlyOnce(
    source,
    importAnchor,
    `${importAnchor}import Foundation\n`,
    'Foundation import',
  );
}

function ensureSwiftImport(source, importName, anchor) {
  const importLine = `import ${importName}\n`;
  const count = countOccurrences(source, importLine);
  if (count === 1) return source;
  if (count > 1) {
    throw new Error(`Widget runtime diagnostics found duplicate ${importName} imports.`);
  }
  return replaceExactlyOnce(source, anchor, `${anchor}${importLine}`, `${importName} import`);
}

function transformSharedWidgetEntryViewSource(source) {
  const markerCount = countOccurrences(source, RUNTIME_DIAGNOSTICS_MARKER);
  if (markerCount > 0) {
    const expected = [
      'event=widget_extension_entry',
      'event=layout_evaluation',
      'event=empty_widget_view',
    ];
    if (
      markerCount !== 1 ||
      expected.some((fragment) => countOccurrences(source, fragment) !== 1) ||
      countOccurrences(source, 'event=layout_lookup') !== 2 ||
      countOccurrences(source, 'widgetDiagnosticsName(entry.name)') < 3
    ) {
      throw new Error(
        'Widget runtime diagnostics found partial shared entry view instrumentation.',
      );
    }
    return source;
  }

  let transformed = ensureSwiftImport(source, 'os', 'import WidgetKit\n');
  transformed = ensureSwiftImport(transformed, 'Foundation', 'import os\n');
  const viewAnchor = 'public struct WidgetsEntryView: View {\n';
  transformed = replaceExactlyOnce(
    transformed,
    viewAnchor,
    `${viewAnchor}  ${RUNTIME_DIAGNOSTICS_MARKER}\n` +
      '  private let diagnosticsLogger = os.Logger(\n' +
      '    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",\n' +
      '    category: "WidgetRenderDiagnostics"\n' +
      '  )\n\n' +
      '  private func widgetDiagnosticsName(_ name: String) -> String {\n' +
      '    ["ResumoFinanceiro", "EntregasDoDia"].contains(name) ? name : "other"\n' +
      '  }\n\n' +
      '  private func widgetAppGroupContainerAvailable() -> Bool {\n' +
      '    guard let groupIdentifier = WidgetsStorage.appGroupIdentifier else { return false }\n' +
      '    return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier) != nil\n' +
      '  }\n',
    'shared widget entry view diagnostics logger',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    self.entry = entry\n',
    '    self.entry = entry\n' +
      '    diagnosticsLogger.info("event=widget_extension_entry widget=\\(widgetDiagnosticsName(entry.name), privacy: .public)")\n',
    'shared widget entry initialization log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n',
    '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n' +
      '      let dynamicLayoutPresent = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout").map { !$0.isEmpty } ?? false\n' +
      '      let layoutSource = dynamicLayoutPresent ? "app_group" : "embedded"\n' +
      '      diagnosticsLogger.info("event=layout_lookup widget=\\(widgetDiagnosticsName(entry.name), privacy: .public) source=\\(layoutSource, privacy: .public) app_group_configured=\\(WidgetsStorage.appGroupIdentifier != nil, privacy: .public) app_group_container=\\(widgetAppGroupContainerAvailable(), privacy: .public)")\n',
    'shared widget layout lookup log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '      let node = evaluateLayout(layout: layout, props: entry.props, environment: widgetEnvironment)\n',
    '      let node = evaluateLayout(layout: layout, props: entry.props, environment: widgetEnvironment)\n' +
      '      let evaluationSucceeded = (node["type"] as? String) != "RedBoxView"\n' +
      '      diagnosticsLogger.info("event=layout_evaluation widget=\\(widgetDiagnosticsName(entry.name), privacy: .public) success=\\(evaluationSucceeded, privacy: .public)")\n',
    'shared widget layout evaluation log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    } else {\n      // No layout is stored until the app has run once after install or\n',
    '    } else {\n' +
      '      diagnosticsLogger.info("event=layout_lookup widget=\\(widgetDiagnosticsName(entry.name), privacy: .public) source=missing app_group_configured=\\(WidgetsStorage.appGroupIdentifier != nil, privacy: .public) app_group_container=\\(widgetAppGroupContainerAvailable(), privacy: .public)")\n' +
      '      diagnosticsLogger.info("event=empty_widget_view widget=\\(widgetDiagnosticsName(entry.name), privacy: .public)")\n' +
      '      // No layout is stored until the app has run once after install or\n',
    'shared empty widget view log',
  );
  return transformed;
}

function transformSharedWidgetTimelineProviderSource(source) {
  const markerCount = countOccurrences(source, RUNTIME_DIAGNOSTICS_MARKER);
  if (markerCount > 0) {
    const expected = [
      'event=timeline_placeholder',
      'event=timeline_snapshot',
      'event=timeline_refresh',
      'app_group_configured=',
    ];
    if (markerCount !== 1 || expected.some((fragment) => countOccurrences(source, fragment) < 1)) {
      throw new Error(
        'Widget runtime diagnostics found partial shared timeline provider instrumentation.',
      );
    }
    return source;
  }

  let transformed = ensureSwiftImport(source, 'os', 'import WidgetKit\n');
  transformed = ensureSwiftImport(transformed, 'Foundation', 'import os\n');
  const providerAnchor = 'public struct WidgetsTimelineProvider: TimelineProvider {\n';
  transformed = replaceExactlyOnce(
    transformed,
    providerAnchor,
    `${providerAnchor}  ${RUNTIME_DIAGNOSTICS_MARKER}\n` +
      '  private let diagnosticsLogger = os.Logger(\n' +
      '    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",\n' +
      '    category: "WidgetRenderDiagnostics"\n' +
      '  )\n\n' +
      '  private func widgetDiagnosticsName(_ name: String) -> String {\n' +
      '    ["ResumoFinanceiro", "EntregasDoDia"].contains(name) ? name : "other"\n' +
      '  }\n',
    'shared timeline provider diagnostics logger',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    WidgetsTimelineEntry(date: Date(), name: name, props: WidgetsLayoutRegistry.initialProps(for: name), entryIndex: nil)\n',
    '    diagnosticsLogger.info("event=timeline_placeholder widget=\\(widgetDiagnosticsName(name), privacy: .public)")\n' +
      '    return WidgetsTimelineEntry(date: Date(), name: name, props: WidgetsLayoutRegistry.initialProps(for: name), entryIndex: nil)\n',
    'shared timeline placeholder log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    guard let groupIdentifier else {\n      completion(WidgetsTimelineEntry(date: Date(), name: name, props: WidgetsLayoutRegistry.initialProps(for: name), entryIndex: nil))\n      return\n',
    '    guard let groupIdentifier else {\n' +
      '      diagnosticsLogger.info("event=timeline_snapshot widget=\\(widgetDiagnosticsName(name), privacy: .public) app_group_configured=false")\n' +
      '      completion(WidgetsTimelineEntry(date: Date(), name: name, props: WidgetsLayoutRegistry.initialProps(for: name), entryIndex: nil))\n' +
      '      return\n',
    'shared snapshot missing app group log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    let entries = parseTimeline(identifier: groupIdentifier, name: name, family: context.family)\n    completion(entries.first ?? WidgetsTimelineEntry(date: Date(), name: name, props: WidgetsLayoutRegistry.initialProps(for: name), entryIndex: nil))\n',
    '    let entries = parseTimeline(identifier: groupIdentifier, name: name, family: context.family)\n' +
      '    diagnosticsLogger.info("event=timeline_snapshot widget=\\(widgetDiagnosticsName(name), privacy: .public) app_group_configured=true timeline_present=\\(WidgetsStorage.getArray(forKey: "__expo_widgets_\\(name)_timeline") != nil, privacy: .public) entry_count=\\(entries.count, privacy: .public)")\n' +
      '    completion(entries.first ?? WidgetsTimelineEntry(date: Date(), name: name, props: WidgetsLayoutRegistry.initialProps(for: name), entryIndex: nil))\n',
    'shared snapshot timeline read log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    guard let groupIdentifier else {\n      fatalError("Could not get the app group identifier from Info.plist")\n',
    '    guard let groupIdentifier else {\n' +
      '      diagnosticsLogger.error("event=timeline_refresh widget=\\(widgetDiagnosticsName(name), privacy: .public) app_group_configured=false")\n' +
      '      fatalError("Could not get the app group identifier from Info.plist")\n',
    'shared timeline missing app group log',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    let timeline = Timeline<WidgetsTimelineEntry>(entries: entries, policy: .atEnd)\n',
    '    diagnosticsLogger.info("event=timeline_refresh widget=\\(widgetDiagnosticsName(name), privacy: .public) app_group_configured=true timeline_present=\\(WidgetsStorage.getArray(forKey: "__expo_widgets_\\(name)_timeline") != nil, privacy: .public) entry_count=\\(entries.count, privacy: .public)")\n' +
      '    let timeline = Timeline<WidgetsTimelineEntry>(entries: entries, policy: .atEnd)\n',
    'shared timeline refresh log',
  );
  return transformed;
}

function transformConfigurableWidgetSource(source, widgetName) {
  const marker = `${RUNTIME_DIAGNOSTICS_MARKER}: ${widgetName}`;
  const markerCount = countOccurrences(source, marker);
  if (markerCount > 0) {
    const expected = [
      'event=timeline_placeholder',
      'event=timeline_snapshot',
      'event=timeline_refresh',
      'event=widget_extension_entry',
      'event=layout_evaluation',
      'event=empty_widget_view',
    ];
    if (
      markerCount !== 1 ||
      expected.some((fragment) => countOccurrences(source, fragment) !== 1) ||
      countOccurrences(source, 'event=layout_lookup') !== 2
    ) {
      throw new Error(`Widget runtime diagnostics found partial ${widgetName} instrumentation.`);
    }
    return source;
  }

  let transformed = ensureSwiftImport(source, 'os', 'import WidgetKit\n');
  transformed = ensureSwiftImport(transformed, 'Foundation', 'import os\n');
  const loggerName = `${widgetName[0].toLowerCase()}${widgetName.slice(1)}WidgetDiagnosticsLogger`;
  const entryAnchor = `struct ${widgetName}TimelineEntry: TimelineEntry {\n`;
  transformed = replaceExactlyOnce(
    transformed,
    entryAnchor,
    `${marker}\nprivate let ${loggerName} = os.Logger(\n` +
      '  subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",\n' +
      '  category: "WidgetRenderDiagnostics"\n' +
      ')\n\n' +
      entryAnchor,
    `${widgetName} diagnostics logger`,
  );

  const logAtFunctionStart = (signature, statement, label) => {
    transformed = replaceExactlyOnce(
      transformed,
      `${signature}\n`,
      `${signature}\n    ${statement}\n`,
      label,
    );
  };
  logAtFunctionStart(
    `  func placeholder(in context: Context) -> ${widgetName}TimelineEntry {`,
    `${loggerName}.info("event=timeline_placeholder widget=${widgetName}")`,
    `${widgetName} placeholder log`,
  );

  const timelineReadAnchor = `    let entries = parseTimeline(configuration: configuration)\n`;
  transformed = replaceExactlyOnce(
    transformed,
    timelineReadAnchor,
    `${timelineReadAnchor}    ${loggerName}.info("event=timeline_snapshot widget=${widgetName} timeline_present=\\(WidgetsStorage.getArray(forKey: \"__expo_widgets_${widgetName}_timeline\") != nil, privacy: .public) entry_count=\\(entries.count, privacy: .public)")\n`,
    `${widgetName} snapshot log`,
  );
  const timelineRefreshAnchor = `    let entries = self.parseTimeline(configuration: configuration)\n`;
  transformed = replaceExactlyOnce(
    transformed,
    timelineRefreshAnchor,
    `${timelineRefreshAnchor}    ${loggerName}.info("event=timeline_refresh widget=${widgetName} timeline_present=\\(WidgetsStorage.getArray(forKey: \"__expo_widgets_${widgetName}_timeline\") != nil, privacy: .public) entry_count=\\(entries.count, privacy: .public)")\n`,
    `${widgetName} timeline refresh log`,
  );

  transformed = replaceExactlyOnce(
    transformed,
    `    self.entry = entry\n`,
    `    self.entry = entry\n    ${loggerName}.info("event=widget_extension_entry widget=${widgetName}")\n`,
    `${widgetName} entry initialization log`,
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n',
    '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n' +
      `      let dynamicLayoutPresent = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout").map { !$0.isEmpty } ?? false\n      let groupIdentifier = WidgetsStorage.appGroupIdentifier\n      let appGroupContainerAvailable = groupIdentifier.map { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil } ?? false\n      let layoutSource = dynamicLayoutPresent ? "app_group" : "embedded"\n      ${loggerName}.info("event=layout_lookup widget=${widgetName} source=\\(layoutSource, privacy: .public) app_group_configured=\\(groupIdentifier != nil, privacy: .public) app_group_container=\\(appGroupContainerAvailable, privacy: .public)")\n`,
    `${widgetName} layout lookup log`,
  );
  transformed = replaceExactlyOnce(
    transformed,
    '      let node = evaluateLayout(layout: layout, props: entry.props, environment: widgetEnvironment)\n',
    '      let node = evaluateLayout(layout: layout, props: entry.props, environment: widgetEnvironment)\n' +
      `      let evaluationSucceeded = (node["type"] as? String) != "RedBoxView"\n      ${loggerName}.info("event=layout_evaluation widget=${widgetName} success=\\(evaluationSucceeded, privacy: .public)")\n`,
    `${widgetName} layout evaluation log`,
  );
  transformed = replaceExactlyOnce(
    transformed,
    '    } else {\n      EmptyWidgetView()\n',
    `    } else {\n      let groupIdentifier = WidgetsStorage.appGroupIdentifier\n      let appGroupContainerAvailable = groupIdentifier.map { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil } ?? false\n      ${loggerName}.info("event=layout_lookup widget=${widgetName} source=missing app_group_configured=\\(groupIdentifier != nil, privacy: .public) app_group_container=\\(appGroupContainerAvailable, privacy: .public)")\n      ${loggerName}.info("event=empty_widget_view widget=${widgetName}")\n      EmptyWidgetView()\n`,
    `${widgetName} empty widget view log`,
  );
  return transformed;
}

function transformExpoWidgetsUtilsSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(BRANDING_MARKER)) {
    const expectedFragments = [
      'Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String',
      'FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)',
      'env["widgetsDirectory"] =',
      'appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    ];
    if (
      countOccurrences(transformed, BRANDING_MARKER) !== 1 ||
      countOccurrences(transformed, 'import Foundation\n') !== 1 ||
      countOccurrences(transformed, ENVIRONMENT_HELPER_ANCHOR) !== 1 ||
      expectedFragments.some((fragment) => countOccurrences(transformed, fragment) !== 1)
    ) {
      throw new Error(
        'ResumoFinanceiro branding CNG plugin found a partial or duplicated shared image path marker.',
      );
    }
    return source;
  }

  if (transformed.includes('env["widgetsDirectory"] =')) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin found an unmarked widgetsDirectory assignment; review the installed Expo Widgets source.',
    );
  }

  transformed = ensureFoundationImport(transformed);
  if (countOccurrences(transformed, ENVIRONMENT_HELPER_ANCHOR) !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one getWidgetEnvironment helper; check the installed Expo Widgets source.',
    );
  }

  const environmentInjection = [
    `  ${BRANDING_MARKER}`,
    '  if let appGroupIdentifier = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,',
    '     let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {',
    '    env["widgetsDirectory"] = appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    '  }',
    ENVIRONMENT_INSERTION_ANCHOR,
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    ENVIRONMENT_INSERTION_ANCHOR,
    environmentInjection,
    'shared image directory',
  );

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function assertExpoWidgetsVersion(packageRoot) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find expo-widgets package metadata at ' +
        packageJsonPath +
        '.',
    );
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.version !== EXPO_WIDGETS_VERSION) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin supports expo-widgets@' +
        EXPO_WIDGETS_VERSION +
        '; found ' +
        packageJson.version +
        '.',
    );
  }
}

function readRequiredSource(sourcePath, label) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find ' + label + ' at ' + sourcePath + '.',
    );
  }
  return fs.readFileSync(sourcePath, 'utf8');
}

function assertExactlyOne(source, value, label) {
  const matches = countOccurrences(source, value);
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one ' +
        label +
        '; found ' +
        matches +
        '. Check the expo-widgets@' +
        EXPO_WIDGETS_VERSION +
        ' generated Swift before building.',
    );
  }
}

function transformExpoWidgetsTarget(projectRoot, packageRoot) {
  const targetDirectory = path.join(projectRoot, 'ExpoWidgetsTarget');
  const resolvedPackageRoot =
    packageRoot ?? path.resolve(projectRoot, '..', 'node_modules', 'expo-widgets');
  assertExpoWidgetsVersion(resolvedPackageRoot);

  const widgetSources = Object.fromEntries(
    WIDGET_SOURCE_NAMES.map((sourceName) => [
      sourceName,
      readRequiredSource(path.join(targetDirectory, sourceName), sourceName),
    ]),
  );

  assertExactlyOne(
    widgetSources['ResumoFinanceiro.swift'],
    'AppIntentConfiguration(',
    'ResumoFinanceiro App Intent configuration',
  );
  assertExactlyOne(
    widgetSources['ResumoFinanceiro.swift'],
    'getWidgetEnvironment(environment: environment)',
    'ResumoFinanceiro environment helper call',
  );
  assertExactlyOne(
    widgetSources['EntregasDoDia.swift'],
    'StaticConfiguration(',
    'EntregasDoDia static configuration',
  );
  assertExactlyOne(
    widgetSources['EntregasDoDia.swift'],
    'WidgetsEntryView(entry: entry)',
    'EntregasDoDia shared entry view',
  );

  const sharedEntryViewPath = path.join(resolvedPackageRoot, 'ios', 'Widgets', 'EntryView.swift');
  const sharedEntryView = readRequiredSource(sharedEntryViewPath, 'shared WidgetsEntryView');
  assertExactlyOne(
    sharedEntryView,
    SHARED_ENTRY_VIEW_ANCHOR,
    'shared WidgetsEntryView environment helper call',
  );

  const utilsPath = path.join(resolvedPackageRoot, 'ios', 'Widgets', 'Utils.swift');
  const originalUtils = readRequiredSource(utilsPath, 'expo-widgets Utils.swift');
  const transformedUtils = transformExpoWidgetsUtilsSource(originalUtils);
  if (transformedUtils !== originalUtils) {
    fs.writeFileSync(utilsPath, transformedUtils);
  }

  const diagnosticsSources = [
    {
      filePath: path.join(targetDirectory, 'ResumoFinanceiro.swift'),
      label: 'ResumoFinanceiro.swift',
      transform: (source) => transformConfigurableWidgetSource(source, 'ResumoFinanceiro'),
    },
    {
      filePath: path.join(resolvedPackageRoot, 'ios', 'Widgets', 'EntryView.swift'),
      label: 'shared WidgetsEntryView',
      transform: transformSharedWidgetEntryViewSource,
    },
    {
      filePath: path.join(resolvedPackageRoot, 'ios', 'Widgets', 'TimelineProvider.swift'),
      label: 'shared WidgetsTimelineProvider',
      transform: transformSharedWidgetTimelineProviderSource,
    },
  ];
  for (const { filePath, label, transform } of diagnosticsSources) {
    const originalSource = readRequiredSource(filePath, label);
    const transformedSource = transform(originalSource);
    if (transformedSource !== originalSource) {
      fs.writeFileSync(filePath, transformedSource);
    }
  }
}

function withResumoFinanceiroBranding(config) {
  return withDangerousMod(config, [
    'ios',
    async (configWithIos) => {
      const projectRoot = configWithIos.modRequest.platformProjectRoot;
      transformExpoWidgetsTarget(projectRoot);
      return configWithIos;
    },
  ]);
}

module.exports = withResumoFinanceiroBranding;
module.exports.transformExpoWidgetsUtilsSource = transformExpoWidgetsUtilsSource;
module.exports.transformExpoWidgetsTarget = transformExpoWidgetsTarget;
module.exports.transformSharedWidgetEntryViewSource = transformSharedWidgetEntryViewSource;
module.exports.transformSharedWidgetTimelineProviderSource =
  transformSharedWidgetTimelineProviderSource;
module.exports.transformConfigurableWidgetSource = transformConfigurableWidgetSource;
