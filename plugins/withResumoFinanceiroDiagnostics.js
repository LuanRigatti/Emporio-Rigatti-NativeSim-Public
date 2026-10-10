const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const WIDGET_SOURCE_NAME = 'ResumoFinanceiro.swift';
const INSTRUMENTATION_MARKER = '// TEMPORARY ResumoFinanceiro OSLog diagnostics';

function replaceExactlyOnce(source, anchor, replacement, label) {
  const matches = source.split(anchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro diagnostics CNG plugin expected exactly one ' +
        label +
        ' insertion point; found ' +
        matches +
        '. Check the expo-widgets generated Swift template before building.',
    );
  }

  return source.replace(anchor, replacement);
}

function transformResumoFinanceiroWidgetSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(INSTRUMENTATION_MARKER)) {
    const expectedEvents = [
      'event=timeline_read source=extension',
      'event=layout_evaluation phase=start',
      'event=layout_evaluation phase=returned',
      'event=layout_evaluation phase=layout_missing',
    ];
    const missingEvents = expectedEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0) {
      throw new Error(
        'ResumoFinanceiro diagnostics CNG plugin found a partial instrumentation marker: ' +
          missingEvents.join(', '),
      );
    }
    return source;
  }

  const importAnchor = 'import AppIntents\ninternal import ExpoWidgets';
  const importReplacement = [
    'import AppIntents',
    'import os',
    'internal import ExpoWidgets',
    '',
    INSTRUMENTATION_MARKER,
    'private let resumoFinanceiroDiagnosticsLogger = Logger(',
    '  subsystem: Bundle.main.bundleIdentifier ?? "ResumoFinanceiro",',
    '  category: "RigattiWidgetSync"',
    ')',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    importAnchor,
    importReplacement,
    'OSLog import/logger',
  );

  const parseAnchor = '    return entries.compactMap(\\.self)';
  const parseReplacement = [
    '    let acceptedEntries = entries.compactMap(\\.self)',
    '    resumoFinanceiroDiagnosticsLogger.info("event=timeline_read source=extension raw_count=\\(timeline.count, privacy: .public) accepted_count=\\(acceptedEntries.count, privacy: .public)")',
    '    return acceptedEntries',
  ].join('\n');
  transformed = replaceExactlyOnce(transformed, parseAnchor, parseReplacement, 'timeline parsing');

  const bodyAnchor = '  public var body: some View {\n    if let layout = WidgetsStorage.getString';
  const bodyReplacement = [
    '  public var body: some View {',
    '    let propsPresent = entry.props != nil',
    '    let configurationPresent = (widgetEnvironment["configuration"] as? [String: Any])?.isEmpty == false',
    '    resumoFinanceiroDiagnosticsLogger.info("event=layout_evaluation phase=start props_present=\\(propsPresent, privacy: .public) configuration_present=\\(configurationPresent, privacy: .public)")',
    '    if let layout = WidgetsStorage.getString',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    bodyAnchor,
    bodyReplacement,
    'layout evaluation start',
  );

  const layoutAnchor =
    '      let node = evaluateLayout(layout: layout, props: entry.props ?? [:], environment: widgetEnvironment)';
  const layoutReplacement = [
    layoutAnchor,
    '      resumoFinanceiroDiagnosticsLogger.info("event=layout_evaluation phase=returned props_present=\\(propsPresent, privacy: .public) configuration_present=\\(configurationPresent, privacy: .public)")',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    layoutAnchor,
    layoutReplacement,
    'layout evaluation result',
  );

  const missingLayoutAnchor =
    '    } else {\n      WidgetsDynamicView(name: entry.name, kind: .widget, node: createRedBox';
  const missingLayoutReplacement = [
    '    } else {',
    '      resumoFinanceiroDiagnosticsLogger.info("event=layout_evaluation phase=layout_missing props_present=\\(propsPresent, privacy: .public) configuration_present=\\(configurationPresent, privacy: .public)")',
    '      WidgetsDynamicView(name: entry.name, kind: .widget, node: createRedBox',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    missingLayoutAnchor,
    missingLayoutReplacement,
    'missing layout branch',
  );

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function withResumoFinanceiroDiagnostics(config) {
  return withDangerousMod(config, [
    'ios',
    async (configWithIos) => {
      const projectRoot = configWithIos.modRequest.platformProjectRoot;
      const widgetSourcePath = path.join(projectRoot, 'ExpoWidgetsTarget', WIDGET_SOURCE_NAME);

      if (!fs.existsSync(widgetSourcePath)) {
        throw new Error(
          'ResumoFinanceiro diagnostics CNG plugin could not find ' +
            widgetSourcePath +
            '. Ensure expo-widgets runs before this plugin and verify its generated target.',
        );
      }

      const originalSource = fs.readFileSync(widgetSourcePath, 'utf8');
      const instrumentedSource = transformResumoFinanceiroWidgetSource(originalSource);
      if (instrumentedSource !== originalSource) {
        fs.writeFileSync(widgetSourcePath, instrumentedSource);
      }

      return configWithIos;
    },
  ]);
}

module.exports = withResumoFinanceiroDiagnostics;
module.exports.transformResumoFinanceiroWidgetSource = transformResumoFinanceiroWidgetSource;
