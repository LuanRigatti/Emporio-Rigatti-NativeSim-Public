const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const WIDGET_SOURCE_NAME = 'ResumoFinanceiro.swift';
const LEGACY_INSTRUMENTATION_MARKER = '// TEMPORARY ResumoFinanceiro OSLog diagnostics';
const PREVIOUS_INSTRUMENTATION_MARKER = `${LEGACY_INSTRUMENTATION_MARKER} v2`;
const INSTRUMENTATION_MARKER = `${LEGACY_INSTRUMENTATION_MARKER} v3`;

function hasUnqualifiedLoggerType(source) {
  return /(?:=|:\s*)Logger\b/.test(source);
}

const IOS_17_WIDGET_DECLARATIONS = [
  'struct ResumoFinanceiroConfigurationAppIntent: WidgetConfigurationIntent {',
  'enum ResumoFinanceiroModeEnum: String, CaseIterable, AppEnum {',
  'enum ResumoFinanceiroDiagnosticVariantEnum: String, CaseIterable, AppEnum {',
  'struct ResumoFinanceiroTimelineEntry: TimelineEntry {',
  'struct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
  'struct ResumoFinanceiroEntryView: View {',
];

function addIOS17Availability(source) {
  let transformed = source;
  for (const declaration of IOS_17_WIDGET_DECLARATIONS) {
    const annotatedDeclaration = `@available(iOS 17.0, *)\n${declaration}`;
    if (transformed.includes(annotatedDeclaration)) continue;
    transformed = replaceExactlyOnce(
      transformed,
      declaration,
      annotatedDeclaration,
      `iOS 17 availability for ${declaration.split(' ').slice(1, 3).join(' ')}`,
    );
  }
  return transformed;
}

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

  if (transformed.includes(`${LEGACY_INSTRUMENTATION_MARKER}\n`)) {
    throw new Error(
      'ResumoFinanceiro diagnostics CNG plugin found legacy instrumentation. Regenerate the ExpoWidgetsTarget from the installed Expo template before building.',
    );
  }

  if (transformed.includes(PREVIOUS_INSTRUMENTATION_MARKER)) {
    const previousEvents = [
      'event=provider_placeholder',
      'event=provider_call path=snapshot',
      'event=provider_result path=snapshot',
      'event=provider_call path=timeline',
      'event=provider_result path=timeline',
      'event=timeline_read source=extension',
      'event=renderer_redaction',
      'event=layout_evaluation phase=returned',
    ];
    const missingEvents = previousEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0) {
      throw new Error(
        'ResumoFinanceiro diagnostics CNG plugin found partial v2 instrumentation: ' +
          missingEvents.join(', '),
      );
    }

    transformed = replaceExactlyOnce(
      transformed,
      'private let resumoFinanceiroDiagnosticsLogger = Logger(',
      'private let resumoFinanceiroDiagnosticsLogger = os.Logger(',
      'v2 OSLog logger qualification',
    );
    transformed = replaceExactlyOnce(
      transformed,
      PREVIOUS_INSTRUMENTATION_MARKER,
      INSTRUMENTATION_MARKER,
      'v2 diagnostics marker upgrade',
    );
    transformed = addIOS17Availability(transformed);
    if (hasUnqualifiedLoggerType(transformed)) {
      throw new Error(
        'ResumoFinanceiro diagnostics CNG plugin could not qualify every Logger reference in v2 instrumentation.',
      );
    }
    return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
  }

  if (transformed.includes(INSTRUMENTATION_MARKER)) {
    const expectedEvents = [
      'event=provider_placeholder',
      'event=provider_call path=snapshot',
      'event=provider_result path=snapshot',
      'event=provider_call path=timeline',
      'event=provider_result path=timeline',
      'event=timeline_read source=extension',
      'event=renderer_redaction',
      'variant_name=',
      'entry_index=',
      'event=layout_evaluation phase=start',
      'event=layout_evaluation phase=returned',
      'event=layout_evaluation phase=failed',
      'event=layout_evaluation phase=layout_missing',
      'import os',
      'resumoFinanceiroDiagnosticsLogger = os.Logger(',
      ...IOS_17_WIDGET_DECLARATIONS.map((declaration) => `@available(iOS 17.0, *)\n${declaration}`),
      '@available(iOS 17.0, *)\nstruct ResumoFinanceiro: Widget {',
    ];
    const missingEvents = expectedEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0 || hasUnqualifiedLoggerType(transformed)) {
      throw new Error(
        'ResumoFinanceiro diagnostics CNG plugin found a partial instrumentation marker: ' +
          [
            ...missingEvents,
            ...(hasUnqualifiedLoggerType(transformed) ? ['qualified os.Logger'] : []),
          ].join(', '),
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
    'private let resumoFinanceiroDiagnosticsLogger = os.Logger(',
    '  subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",',
    '  category: "RigattiWidgetSync"',
    ')',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    importAnchor,
    importReplacement,
    'OSLog import/logger',
  );

  const placeholderAnchor = [
    '  func placeholder(in context: Context) -> ResumoFinanceiroTimelineEntry {',
    '    ResumoFinanceiroTimelineEntry(date: Date(), name: "ResumoFinanceiro", props: nil, entryIndex: nil, configuration: ResumoFinanceiroConfigurationAppIntent())',
    '  }',
  ].join('\n');
  const placeholderReplacement = [
    '  func placeholder(in context: Context) -> ResumoFinanceiroTimelineEntry {',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=provider_placeholder is_preview=\\(context.isPreview, privacy: .public) family=\\(String(describing: context.family), privacy: .public) props_present=false")',
    '    return ResumoFinanceiroTimelineEntry(date: Date(), name: "ResumoFinanceiro", props: nil, entryIndex: nil, configuration: ResumoFinanceiroConfigurationAppIntent())',
    '  }',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    placeholderAnchor,
    placeholderReplacement,
    'placeholder provider',
  );

  const snapshotAnchor = [
    '  func snapshot(for configuration: ResumoFinanceiroConfigurationAppIntent, in context: Context) async -> ResumoFinanceiroTimelineEntry {',
    '    let entries = parseTimeline(configuration: configuration)',
    '    return entries.first ?? ResumoFinanceiroTimelineEntry(date: Date(), name: "ResumoFinanceiro", props: nil, entryIndex: nil, configuration: configuration)',
    '  }',
  ].join('\n');
  const snapshotReplacement = [
    '  func snapshot(for configuration: ResumoFinanceiroConfigurationAppIntent, in context: Context) async -> ResumoFinanceiroTimelineEntry {',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=provider_call path=snapshot is_preview=\\(context.isPreview, privacy: .public) family=\\(String(describing: context.family), privacy: .public)")',
    '    let entries = parseTimeline(configuration: configuration, source: "snapshot")',
    '    let entry = entries.first ?? ResumoFinanceiroTimelineEntry(date: Date(), name: "ResumoFinanceiro", props: nil, entryIndex: nil, configuration: configuration)',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=provider_result path=snapshot is_preview=\\(context.isPreview, privacy: .public) entry_present=\\(entry.props != nil, privacy: .public) accepted_count=\\(entries.count, privacy: .public)")',
    '    return entry',
    '  }',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    snapshotAnchor,
    snapshotReplacement,
    'snapshot provider',
  );

  const timelineAnchor = [
    '  func timeline(for configuration: ResumoFinanceiroConfigurationAppIntent, in context: Context) async -> Timeline<ResumoFinanceiroTimelineEntry> {',
    '    let entries = self.parseTimeline(configuration: configuration)',
    '    let timeline = Timeline<ResumoFinanceiroTimelineEntry>(entries: entries, policy: .atEnd)',
    '    return timeline',
    '  }',
  ].join('\n');
  const timelineReplacement = [
    '  func timeline(for configuration: ResumoFinanceiroConfigurationAppIntent, in context: Context) async -> Timeline<ResumoFinanceiroTimelineEntry> {',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=provider_call path=timeline is_preview=\\(context.isPreview, privacy: .public) family=\\(String(describing: context.family), privacy: .public)")',
    '    let entries = self.parseTimeline(configuration: configuration, source: "timeline")',
    '    let timeline = Timeline<ResumoFinanceiroTimelineEntry>(entries: entries, policy: .atEnd)',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=provider_result path=timeline entry_count=\\(timeline.entries.count, privacy: .public) policy=at_end")',
    '    return timeline',
    '  }',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    timelineAnchor,
    timelineReplacement,
    'timeline provider',
  );

  const parseSignature =
    '  func parseTimeline(configuration: ResumoFinanceiroConfigurationAppIntent) -> [ResumoFinanceiroTimelineEntry] {';
  transformed = replaceExactlyOnce(
    transformed,
    parseSignature,
    '  func parseTimeline(configuration: ResumoFinanceiroConfigurationAppIntent, source: String) -> [ResumoFinanceiroTimelineEntry] {',
    'timeline parser signature',
  );

  const parseAnchor = '    return entries.compactMap(\\.self)';
  const parseReplacement = [
    '    let acceptedEntries = entries.compactMap(\\.self)',
    '    let firstEntry = acceptedEntries.first',
    '    let firstEntryProps = firstEntry?.props',
    '    let wholesaleProps = firstEntryProps?["wholesale"] as? [String: Any]',
    '    let retailProps = firstEntryProps?["retail"] as? [String: Any]',
    '    let firstEntryIndex = firstEntry?.entryIndex ?? -1',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=timeline_read source=extension path=\\(source, privacy: .public) raw_count=\\(timeline.count, privacy: .public) accepted_count=\\(acceptedEntries.count, privacy: .public) first_entry_present=\\(firstEntry != nil, privacy: .public) first_entry_index=\\(firstEntryIndex, privacy: .public) wholesale_faturamento_present=\\(wholesaleProps?["faturamento"] is String, privacy: .public) wholesale_lucro_present=\\(wholesaleProps?["lucroLiquido"] is String, privacy: .public) retail_faturamento_present=\\(retailProps?["faturamento"] is String, privacy: .public) retail_lucro_present=\\(retailProps?["lucroLiquido"] is String, privacy: .public)")',
    '    return acceptedEntries',
  ].join('\n');
  transformed = replaceExactlyOnce(transformed, parseAnchor, parseReplacement, 'timeline parsing');

  const bodyAnchor = '  public var body: some View {\n    if let layout = WidgetsStorage.getString';
  const bodyReplacement = [
    '  private var hasInvalidatedWidgetRedaction: Bool {',
    '    if #available(iOS 17.0, *) {',
    '      return environment.redactionReasons.contains(.invalidated)',
    '    }',
    '    return false',
    '  }',
    '',
    '  public var body: some View {',
    '    let props = entry.props',
    '    let wholesaleProps = props?["wholesale"] as? [String: Any]',
    '    let retailProps = props?["retail"] as? [String: Any]',
    '    let configuration = widgetEnvironment["configuration"] as? [String: Any]',
    '    let mode = configuration?["mode"] as? String',
    '    let variant = configuration?["diagnosticVariant"] as? String',
    '    let knownVariants = ["full", "without_image", "static_test", "previous_layout", "redaction", "redaction_unredacted"]',
    '    let variantName = knownVariants.contains(variant ?? "") ? (variant ?? "unknown") : "unknown"',
    '    let entryIndex = entry.entryIndex ?? -1',
    '    let modeIsWholesale = mode == "wholesale"',
    '    let modeIsRetail = mode == "retail"',
    '    let hasPlaceholderRedaction = environment.redactionReasons.contains(.placeholder)',
    '    let hasPrivacyRedaction = environment.redactionReasons.contains(.privacy)',
    '    let hasInvalidatedRedaction = hasInvalidatedWidgetRedaction',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=renderer_redaction placeholder=\\(hasPlaceholderRedaction, privacy: .public) privacy=\\(hasPrivacyRedaction, privacy: .public) invalidated=\\(hasInvalidatedRedaction, privacy: .public) mode_wholesale=\\(modeIsWholesale, privacy: .public) mode_retail=\\(modeIsRetail, privacy: .public) variant_name=\\(variantName, privacy: .public) entry_index=\\(entryIndex, privacy: .public)")',
    '    let propsPresent = props?.isEmpty == false',
    '    let configurationPresent = configuration?.isEmpty == false',
    '    let _ = resumoFinanceiroDiagnosticsLogger.info("event=layout_evaluation phase=start props_present=\\(propsPresent, privacy: .public) configuration_present=\\(configurationPresent, privacy: .public) entry_index=\\(entryIndex, privacy: .public) variant_name=\\(variantName, privacy: .public) wholesale_faturamento_present=\\(wholesaleProps?["faturamento"] is String, privacy: .public) wholesale_lucro_present=\\(wholesaleProps?["lucroLiquido"] is String, privacy: .public) retail_faturamento_present=\\(retailProps?["faturamento"] is String, privacy: .public) retail_lucro_present=\\(retailProps?["lucroLiquido"] is String, privacy: .public)")',
    '    if let layout = WidgetsStorage.getString',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    bodyAnchor,
    bodyReplacement,
    'layout evaluation context',
  );

  const layoutAnchor =
    '      let node = evaluateLayout(layout: layout, props: entry.props ?? [:], environment: widgetEnvironment)';
  const layoutReplacement = [
    layoutAnchor,
    '      let evaluationFailed = (node["type"] as? String) == "RedBoxView"',
    '      if evaluationFailed {',
    '        let _ = resumoFinanceiroDiagnosticsLogger.error("event=layout_evaluation phase=failed stage=javascript_layout entry_index=\\(entryIndex, privacy: .public) variant_name=\\(variantName, privacy: .public)")',
    '      } else {',
    '        let _ = resumoFinanceiroDiagnosticsLogger.info("event=layout_evaluation phase=returned props_present=\\(propsPresent, privacy: .public) configuration_present=\\(configurationPresent, privacy: .public) entry_index=\\(entryIndex, privacy: .public) variant_name=\\(variantName, privacy: .public)")',
    '      }',
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
    '      let _ = resumoFinanceiroDiagnosticsLogger.error("event=layout_evaluation phase=layout_missing props_present=\\(propsPresent, privacy: .public) configuration_present=\\(configurationPresent, privacy: .public) entry_index=\\(entryIndex, privacy: .public) variant_name=\\(variantName, privacy: .public)")',
    '      WidgetsDynamicView(name: entry.name, kind: .widget, node: createRedBox',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    missingLayoutAnchor,
    missingLayoutReplacement,
    'missing layout branch',
  );

  transformed = addIOS17Availability(transformed);

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
