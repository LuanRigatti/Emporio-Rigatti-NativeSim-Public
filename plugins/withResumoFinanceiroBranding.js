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

function getWidgetEntryViewBody(source, viewStructAnchor, label) {
  if (countOccurrences(source, viewStructAnchor) !== 1) {
    throw new Error('Widget runtime diagnostics expected one ' + label + ' view struct.');
  }

  const viewStructStart = source.indexOf(viewStructAnchor);
  const bodyAnchor = '  public var body: some View {\n';
  const bodyStart = source.indexOf(bodyAnchor, viewStructStart);
  const bodyContentsStart = bodyStart + bodyAnchor.length;
  const bodyEnd = source.indexOf('\n  }\n}', bodyContentsStart);
  if (bodyStart < 0 || bodyEnd < 0) {
    throw new Error('Widget runtime diagnostics could not locate ' + label + ' view body.');
  }

  return {
    body: source.slice(bodyContentsStart, bodyEnd),
    bodyStart,
    bodyContentsStart,
    bodyEnd,
  };
}

function replaceWidgetEntryViewBody(source, viewStructAnchor, label) {
  const viewBody = getWidgetEntryViewBody(source, viewStructAnchor, label);
  const layoutLookupAnchor = 'if let layout = WidgetsLayoutRegistry.layout(for: entry.name)';
  if (countOccurrences(viewBody.body, layoutLookupAnchor) !== 1) {
    throw new Error(
      'Widget runtime diagnostics expected one layout branch in ' + label + ' view body.',
    );
  }

  const replacementBody =
    '    if let layout = WidgetsLayoutRegistry.layout(for: entry.name) {\n' +
    '      diagnosedLayoutView(layout: layout)\n' +
    '    } else {\n' +
    '      diagnosedEmptyWidgetView()\n' +
    '    }';
  return (
    source.slice(0, viewBody.bodyContentsStart) + replacementBody + source.slice(viewBody.bodyEnd)
  );
}

function ensureWidgetViewDiagnosticsMethods(source, viewStructAnchor, methods, label) {
  const layoutSignature = '  private func diagnosedLayoutView(layout: String) -> some View {';
  const emptySignature = '  private func diagnosedEmptyWidgetView() -> EmptyWidgetView {';
  const layoutCount = countOccurrences(source, layoutSignature);
  const emptyCount = countOccurrences(source, emptySignature);
  if (layoutCount === 1 && emptyCount === 1) return source;
  if (layoutCount !== 0 || emptyCount !== 0) {
    throw new Error('Widget runtime diagnostics found partial ' + label + ' view helper methods.');
  }

  const viewBody = getWidgetEntryViewBody(source, viewStructAnchor, label);
  return source.slice(0, viewBody.bodyStart) + methods + '\n\n' + source.slice(viewBody.bodyStart);
}

function createWidgetViewDiagnosticsMethods(loggerName, widgetName, useDynamicName) {
  const widgetLabel = useDynamicName
    ? '\\(widgetDiagnosticsName(entry.name), privacy: .public)'
    : widgetName;
  const methods = [
    '  private func diagnosedLayoutView(layout: String) -> some View {',
    '    let dynamicLayoutPresent = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout").map { !$0.isEmpty } ?? false',
    '    let groupIdentifier = WidgetsStorage.appGroupIdentifier',
    '    let appGroupContainerAvailable = groupIdentifier.map { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil } ?? false',
    '    let layoutSource = dynamicLayoutPresent ? "app_group" : "embedded"',
    '    ' +
      loggerName +
      '.info("event=layout_lookup widget=' +
      widgetLabel +
      ' source=\\(layoutSource, privacy: .public) app_group_configured=\\(groupIdentifier != nil, privacy: .public) app_group_container=\\(appGroupContainerAvailable, privacy: .public)")',
    '    let node = evaluateLayout(layout: layout, props: entry.props, environment: widgetEnvironment)',
    '    let evaluationSucceeded = (node["type"] as? String) != "RedBoxView"',
    '    ' +
      loggerName +
      '.info("event=layout_evaluation widget=' +
      widgetLabel +
      ' success=\\(evaluationSucceeded, privacy: .public)")',
    '    return WidgetsDynamicView(name: entry.name, kind: .widget, node: node, entryIndex: entry.entryIndex, environmentString: widgetEnvironmentString)',
    '  }',
    '',
    '  private func diagnosedEmptyWidgetView() -> EmptyWidgetView {',
    '    let groupIdentifier = WidgetsStorage.appGroupIdentifier',
    '    let appGroupContainerAvailable = groupIdentifier.map { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil } ?? false',
    '    ' +
      loggerName +
      '.info("event=layout_lookup widget=' +
      widgetLabel +
      ' source=missing app_group_configured=\\(groupIdentifier != nil, privacy: .public) app_group_container=\\(appGroupContainerAvailable, privacy: .public)")',
    '    ' + loggerName + '.info("event=empty_widget_view widget=' + widgetLabel + '")',
    '    return EmptyWidgetView()',
    '  }',
  ];
  return methods.join('\n');
}

function assertWidgetViewDiagnostics(source, viewStructAnchor, label, additionalExpectedEvents) {
  const expectedEvents = [
    ['event=widget_extension_entry', 1],
    ['event=layout_lookup', 2],
    ['event=layout_evaluation', 1],
    ['event=empty_widget_view', 1],
    ...(additionalExpectedEvents ?? []),
  ];
  if (
    countOccurrences(source, RUNTIME_DIAGNOSTICS_MARKER) !== 1 ||
    expectedEvents.some(([event, count]) => countOccurrences(source, event) !== count)
  ) {
    throw new Error('Widget runtime diagnostics found incomplete ' + label + ' instrumentation.');
  }

  const viewBody = getWidgetEntryViewBody(source, viewStructAnchor, label).body;
  if (
    countOccurrences(viewBody, 'diagnosedLayoutView(layout: layout)') !== 1 ||
    countOccurrences(viewBody, 'diagnosedEmptyWidgetView()') !== 1 ||
    /\.(info|error|debug|notice|warning)\(/.test(viewBody)
  ) {
    throw new Error(
      'Widget runtime diagnostics found logging inside the ' + label + ' ViewBuilder.',
    );
  }
}

function transformSharedWidgetEntryViewSource(source) {
  const viewStructAnchor = 'public struct WidgetsEntryView: View {\n';
  const layoutSignature = '  private func diagnosedLayoutView(layout: String) -> some View {';
  const emptySignature = '  private func diagnosedEmptyWidgetView() -> EmptyWidgetView {';
  const layoutCount = countOccurrences(source, layoutSignature);
  const emptyCount = countOccurrences(source, emptySignature);
  if (layoutCount > 0 || emptyCount > 0) {
    if (layoutCount !== 1 || emptyCount !== 1) {
      throw new Error('Widget runtime diagnostics found partial shared entry view helper methods.');
    }
    assertWidgetViewDiagnostics(source, viewStructAnchor, 'shared entry view');
    return source;
  }

  let transformed = ensureSwiftImport(source, 'os', 'import WidgetKit\n');
  transformed = ensureSwiftImport(transformed, 'Foundation', 'import os\n');
  const markerCount = countOccurrences(transformed, RUNTIME_DIAGNOSTICS_MARKER);
  const loggerCount = countOccurrences(transformed, 'private let diagnosticsLogger = os.Logger(');
  const nameHelperCount = countOccurrences(
    transformed,
    '  private func widgetDiagnosticsName(_ name: String) -> String {',
  );
  if (markerCount > 1 || loggerCount > 1 || nameHelperCount > 1) {
    throw new Error('Widget runtime diagnostics found duplicate shared entry view scaffolding.');
  }
  if (markerCount === 0) {
    if (loggerCount !== 0 || nameHelperCount !== 0) {
      throw new Error('Widget runtime diagnostics found unmarked shared entry view scaffolding.');
    }
    transformed = replaceExactlyOnce(
      transformed,
      viewStructAnchor,
      viewStructAnchor +
        '  ' +
        RUNTIME_DIAGNOSTICS_MARKER +
        '\n' +
        '  private let diagnosticsLogger = os.Logger(\n' +
        '    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",\n' +
        '    category: "WidgetRenderDiagnostics"\n' +
        '  )\n\n' +
        '  private func widgetDiagnosticsName(_ name: String) -> String {\n' +
        '    ["ResumoFinanceiro", "EntregasDoDia"].contains(name) ? name : "other"\n' +
        '  }\n',
      'shared widget entry view diagnostics logger',
    );
  } else if (loggerCount !== 1 || nameHelperCount !== 1) {
    throw new Error(
      'Widget runtime diagnostics found incomplete legacy shared entry view scaffolding.',
    );
  }

  const entryEventCount = countOccurrences(transformed, 'event=widget_extension_entry');
  if (entryEventCount > 1) {
    throw new Error('Widget runtime diagnostics found duplicate shared entry initialization logs.');
  }
  if (entryEventCount === 0) {
    transformed = replaceExactlyOnce(
      transformed,
      '    self.entry = entry\n',
      '    self.entry = entry\n' +
        '    diagnosticsLogger.info("event=widget_extension_entry widget=\\(widgetDiagnosticsName(entry.name), privacy: .public)")\n',
      'shared widget entry initialization log',
    );
  }

  transformed = ensureWidgetViewDiagnosticsMethods(
    transformed,
    viewStructAnchor,
    createWidgetViewDiagnosticsMethods(
      'diagnosticsLogger',
      '\\(widgetDiagnosticsName(entry.name), privacy: .public)',
      true,
    ),
    'shared entry view',
  );
  transformed = replaceWidgetEntryViewBody(transformed, viewStructAnchor, 'shared entry view');
  assertWidgetViewDiagnostics(transformed, viewStructAnchor, 'shared entry view');
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
  const marker = RUNTIME_DIAGNOSTICS_MARKER + ': ' + widgetName;
  const loggerName = widgetName[0].toLowerCase() + widgetName.slice(1) + 'WidgetDiagnosticsLogger';
  const viewStructAnchor = 'struct ' + widgetName + 'EntryView: View {\n';
  const layoutSignature = '  private func diagnosedLayoutView(layout: String) -> some View {';
  const emptySignature = '  private func diagnosedEmptyWidgetView() -> EmptyWidgetView {';
  const layoutCount = countOccurrences(source, layoutSignature);
  const emptyCount = countOccurrences(source, emptySignature);
  if (layoutCount > 0 || emptyCount > 0) {
    if (layoutCount !== 1 || emptyCount !== 1) {
      throw new Error(
        'Widget runtime diagnostics found partial ' + widgetName + ' view helper methods.',
      );
    }
    assertWidgetViewDiagnostics(source, viewStructAnchor, widgetName, [
      ['event=timeline_placeholder', 1],
      ['event=timeline_snapshot', 1],
      ['event=timeline_refresh', 1],
    ]);
    return source;
  }

  let transformed = ensureSwiftImport(source, 'os', 'import WidgetKit\n');
  transformed = ensureSwiftImport(transformed, 'Foundation', 'import os\n');
  const markerCount = countOccurrences(transformed, marker);
  const loggerDeclaration = 'private let ' + loggerName + ' = os.Logger(';
  const loggerCount = countOccurrences(transformed, loggerDeclaration);
  if (markerCount > 1 || loggerCount > 1) {
    throw new Error('Widget runtime diagnostics found duplicate ' + widgetName + ' scaffolding.');
  }
  if (markerCount === 0) {
    if (loggerCount !== 0) {
      throw new Error(
        'Widget runtime diagnostics found unmarked ' + widgetName + ' logger scaffolding.',
      );
    }
    const entryAnchor = 'struct ' + widgetName + 'TimelineEntry: TimelineEntry {\n';
    transformed = replaceExactlyOnce(
      transformed,
      entryAnchor,
      RUNTIME_DIAGNOSTICS_MARKER +
        ': ' +
        widgetName +
        '\n' +
        'private let ' +
        loggerName +
        ' = os.Logger(\n' +
        '  subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",\n' +
        '  category: "WidgetRenderDiagnostics"\n' +
        ')\n\n' +
        entryAnchor,
      widgetName + ' diagnostics logger',
    );
  } else if (loggerCount !== 1) {
    throw new Error(
      'Widget runtime diagnostics found incomplete legacy ' + widgetName + ' scaffolding.',
    );
  }

  const entryEventCount = countOccurrences(transformed, 'event=widget_extension_entry');
  if (entryEventCount > 1) {
    throw new Error(
      'Widget runtime diagnostics found duplicate ' + widgetName + ' initialization logs.',
    );
  }
  if (entryEventCount === 0) {
    transformed = replaceExactlyOnce(
      transformed,
      '    self.entry = entry\n',
      '    self.entry = entry\n' +
        '    ' +
        loggerName +
        '.info("event=widget_extension_entry widget=' +
        widgetName +
        '")\n',
      widgetName + ' entry initialization log',
    );
  }

  const timelineLogs = [
    {
      event: 'event=timeline_placeholder',
      anchor: '  func placeholder(in context: Context) -> ' + widgetName + 'TimelineEntry {\n',
      statement: loggerName + '.info("event=timeline_placeholder widget=' + widgetName + '")',
      label: widgetName + ' placeholder log',
    },
    {
      event: 'event=timeline_snapshot',
      anchor: '    let entries = parseTimeline(configuration: configuration)\n',
      statement:
        loggerName +
        '.info("event=timeline_snapshot widget=' +
        widgetName +
        ' timeline_present=\\(WidgetsStorage.getArray(forKey: "__expo_widgets_' +
        widgetName +
        '_timeline") != nil, privacy: .public) entry_count=\\(entries.count, privacy: .public)")',
      label: widgetName + ' snapshot log',
    },
    {
      event: 'event=timeline_refresh',
      anchor: '    let entries = self.parseTimeline(configuration: configuration)\n',
      statement:
        loggerName +
        '.info("event=timeline_refresh widget=' +
        widgetName +
        ' timeline_present=\\(WidgetsStorage.getArray(forKey: "__expo_widgets_' +
        widgetName +
        '_timeline") != nil, privacy: .public) entry_count=\\(entries.count, privacy: .public)")',
      label: widgetName + ' timeline refresh log',
    },
  ];
  for (const { event, anchor, statement, label } of timelineLogs) {
    const eventCount = countOccurrences(transformed, event);
    if (eventCount > 1) {
      throw new Error(
        'Widget runtime diagnostics found duplicate ' + event + ' logs for ' + widgetName + '.',
      );
    }
    if (eventCount === 0) {
      transformed = replaceExactlyOnce(
        transformed,
        anchor,
        anchor + '    ' + statement + '\n',
        label,
      );
    }
  }

  transformed = ensureWidgetViewDiagnosticsMethods(
    transformed,
    viewStructAnchor,
    createWidgetViewDiagnosticsMethods(loggerName, widgetName, false),
    widgetName,
  );
  transformed = replaceWidgetEntryViewBody(transformed, viewStructAnchor, widgetName);
  assertWidgetViewDiagnostics(transformed, viewStructAnchor, widgetName, [
    ['event=timeline_placeholder', 1],
    ['event=timeline_snapshot', 1],
    ['event=timeline_refresh', 1],
  ]);
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
