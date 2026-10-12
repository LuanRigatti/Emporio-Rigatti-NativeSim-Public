const { transformResumoFinanceiroWidgetSource } = jest.requireActual<{
  transformResumoFinanceiroWidgetSource: (source: string) => string;
}>('../../plugins/withResumoFinanceiroDiagnostics');

const generatedWidgetSource = [
  'import WidgetKit',
  'import SwiftUI',
  'import AppIntents',
  'internal import ExpoWidgets',
  '',
  'struct ResumoFinanceiroConfigurationAppIntent: WidgetConfigurationIntent {',
  '}',
  'enum ResumoFinanceiroModeEnum: String, CaseIterable, AppEnum {',
  '  case wholesale',
  '  case retail',
  '}',
  'enum ResumoFinanceiroDiagnosticVariantEnum: String, CaseIterable, AppEnum {',
  '  case full',
  '  case without_image',
  '  case static_test',
  '  case previous_layout',
  '  case redaction',
  '  case redaction_unredacted',
  '}',
  'struct ResumoFinanceiroTimelineEntry: TimelineEntry {',
  '  let date: Date',
  '  let configuration: ResumoFinanceiroConfigurationAppIntent',
  '}',
  '',
  'struct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
  '  func placeholder(in context: Context) -> ResumoFinanceiroTimelineEntry {',
  '    ResumoFinanceiroTimelineEntry(date: Date(), name: "ResumoFinanceiro", props: nil, entryIndex: nil, configuration: ResumoFinanceiroConfigurationAppIntent())',
  '  }',
  '',
  '  func snapshot(for configuration: ResumoFinanceiroConfigurationAppIntent, in context: Context) async -> ResumoFinanceiroTimelineEntry {',
  '    let entries = parseTimeline(configuration: configuration)',
  '    return entries.first ?? ResumoFinanceiroTimelineEntry(date: Date(), name: "ResumoFinanceiro", props: nil, entryIndex: nil, configuration: configuration)',
  '  }',
  '',
  '  func timeline(for configuration: ResumoFinanceiroConfigurationAppIntent, in context: Context) async -> Timeline<ResumoFinanceiroTimelineEntry> {',
  '    let entries = self.parseTimeline(configuration: configuration)',
  '    let timeline = Timeline<ResumoFinanceiroTimelineEntry>(entries: entries, policy: .atEnd)',
  '    return timeline',
  '  }',
  '  ',
  '  func parseTimeline(configuration: ResumoFinanceiroConfigurationAppIntent) -> [ResumoFinanceiroTimelineEntry] {',
  '    let timeline = WidgetsStorage.getArray(forKey: "__expo_widgets_ResumoFinanceiro_timeline") ?? []',
  '    let entries: [ResumoFinanceiroTimelineEntry?] = timeline.enumerated().map { index, entry in',
  '      guard let entry = entry as? [String: Any], let timestamp = entry["timestamp"] as? Int, let props = entry["props"] as? [String: Any] else {',
  '        return nil',
  '      }',
  '      return ResumoFinanceiroTimelineEntry(date: Date(timeIntervalSince1970: Double(timestamp) / 1000), name: "ResumoFinanceiro", props: props, entryIndex: index, configuration: configuration)',
  '    }',
  '',
  '    return entries.compactMap(\\.self)',
  '  }',
  '}',
  '',
  'struct ResumoFinanceiroEntryView: View {',
  '  @Environment(\\.self) var environment',
  '  var entry: ResumoFinanceiroTimelineProvider.Entry',
  '',
  '  init(entry: ResumoFinanceiroTimelineProvider.Entry) {',
  '    self.entry = entry',
  '  }',
  '',
  '  private var widgetEnvironment: [String: Any] {',
  '    var env: [String: Any] = getWidgetEnvironment(environment: environment)',
  '    env["timestamp"] = Int(entry.date.timeIntervalSince1970 * 1000)',
  '    env["configuration"] = [',
  '      "mode": entry.configuration.mode.rawValue,',
  '      "diagnosticVariant": entry.configuration.diagnosticVariant.rawValue',
  '    ]',
  '    return env',
  '  }',
  '',
  '  private var widgetEnvironmentString: String? {',
  '    guard let data = try? JSONSerialization.data(withJSONObject: widgetEnvironment),',
  '          let jsonString = String(data: data, encoding: .utf8) else {',
  '      return nil',
  '    }',
  '    return jsonString',
  '  }',
  '',
  '  public var body: some View {',
  '    if let layout = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout"),',
  '       !layout.isEmpty {',
  '      let node = evaluateLayout(layout: layout, props: entry.props ?? [:], environment: widgetEnvironment)',
  '      WidgetsDynamicView(name: entry.name, kind: .widget, node: node, entryIndex: entry.entryIndex, environmentString: widgetEnvironmentString)',
  '    } else {',
  '      WidgetsDynamicView(name: entry.name, kind: .widget, node: createRedBox(message: "No layout found"), entryIndex: entry.entryIndex, environmentString: widgetEnvironmentString)',
  '    }',
  '  }',
  '}',
  '',
  '@available(iOS 17.0, *)',
  'struct ResumoFinanceiro: Widget {',
  '  var body: some WidgetConfiguration { EmptyWidgetConfiguration() }',
  '}',
].join('\n');

describe('ResumoFinanceiro diagnostics CNG plugin', () => {
  it('instruments the provider, current entry, configuration and redaction without logging values', () => {
    const instrumented = transformResumoFinanceiroWidgetSource(generatedWidgetSource);
    const viewBuilderBody = instrumented.match(
      /  public var body: some View \{\n([\s\S]*?)\n  \}\n\}/,
    )?.[1];

    expect(instrumented).toContain('category: "RigattiWidgetSync"');
    expect(instrumented).toContain('import os');
    expect(instrumented).toContain('resumoFinanceiroDiagnosticsLogger = os.Logger(');
    expect(instrumented).not.toMatch(/(?:=|:\s*)Logger\b/);
    for (const declaration of [
      'struct ResumoFinanceiroConfigurationAppIntent: WidgetConfigurationIntent {',
      'enum ResumoFinanceiroModeEnum: String, CaseIterable, AppEnum {',
      'enum ResumoFinanceiroDiagnosticVariantEnum: String, CaseIterable, AppEnum {',
      'struct ResumoFinanceiroTimelineEntry: TimelineEntry {',
      'struct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
      'struct ResumoFinanceiroEntryView: View {',
    ]) {
      expect(instrumented).toContain(`@available(iOS 17.0, *)\n${declaration}`);
    }
    expect(instrumented).toContain('event=provider_placeholder');
    expect(instrumented).toContain('event=provider_call path=snapshot');
    expect(instrumented).toContain('event=provider_result path=snapshot');
    expect(instrumented).toContain('event=provider_call path=timeline');
    expect(instrumented).toContain('event=provider_result path=timeline');
    expect(instrumented).toContain('event=timeline_read source=extension path=');
    expect(instrumented).toContain('first_entry_present=');
    expect(instrumented).toContain('first_entry_index=');
    expect(instrumented).not.toContain('current_entry_present=');
    expect(instrumented).toContain('hasInvalidatedWidgetRedaction');
    expect(instrumented).toContain('event=renderer_redaction');
    expect(instrumented).toContain('variant_name=');
    expect(instrumented).toContain('entry_index=');
    expect(instrumented).toContain('mode_wholesale=');
    expect(instrumented).toContain('mode_retail=');
    expect(instrumented).toContain('wholesale_faturamento_present=');
    expect(instrumented).toContain('retail_lucro_present=');
    expect(instrumented).not.toContain('faturamento=\\(');
    expect(instrumented).not.toContain('lucroLiquido=\\(');
    expect(viewBuilderBody).toBeDefined();
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=start');
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=returned');
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=failed');
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=layout_missing');
    expect(viewBuilderBody).not.toContain('var hasInvalidatedRedaction = false');
    expect(transformResumoFinanceiroWidgetSource(instrumented)).toBe(instrumented);
  });

  it('migrates cached v2 output to a qualified Logger without losing diagnostics', () => {
    const instrumented = transformResumoFinanceiroWidgetSource(generatedWidgetSource);
    let staleV2 = instrumented;
    for (const declaration of [
      'struct ResumoFinanceiroConfigurationAppIntent: WidgetConfigurationIntent {',
      'enum ResumoFinanceiroModeEnum: String, CaseIterable, AppEnum {',
      'enum ResumoFinanceiroDiagnosticVariantEnum: String, CaseIterable, AppEnum {',
      'struct ResumoFinanceiroTimelineEntry: TimelineEntry {',
      'struct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
      'struct ResumoFinanceiroEntryView: View {',
    ]) {
      staleV2 = staleV2.replace(`@available(iOS 17.0, *)\n${declaration}`, declaration);
    }
    staleV2 = staleV2
      .replace(
        '// TEMPORARY ResumoFinanceiro OSLog diagnostics v3',
        '// TEMPORARY ResumoFinanceiro OSLog diagnostics v2',
      )
      .replace('os.Logger(', 'Logger(');

    const migrated = transformResumoFinanceiroWidgetSource(staleV2);

    expect(migrated).toContain('ResumoFinanceiro OSLog diagnostics v3');
    expect(migrated).toContain('resumoFinanceiroDiagnosticsLogger = os.Logger(');
    expect(migrated).not.toMatch(/(?:=|:\s*)Logger\b/);
    expect(migrated).toContain(
      '@available(iOS 17.0, *)\nstruct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
    );
    expect(transformResumoFinanceiroWidgetSource(migrated)).toBe(migrated);
  });

  it('preserves CRLF and fails clearly when the expo-widgets template changes', () => {
    const windowsSource = generatedWidgetSource.replace(/\n/g, '\r\n');
    const instrumented = transformResumoFinanceiroWidgetSource(windowsSource);

    expect(instrumented).toContain('\r\n');
    expect(instrumented.replace(/\r\n/g, '')).not.toContain('\n');
    expect(() =>
      transformResumoFinanceiroWidgetSource(
        generatedWidgetSource.replace(
          '    return entries.compactMap(\\.self)',
          '    return entries',
        ),
      ),
    ).toThrow('timeline parsing insertion point');
  });

  it('rejects older instrumentation instead of silently retaining incomplete coverage', () => {
    const instrumented = transformResumoFinanceiroWidgetSource(generatedWidgetSource);
    const legacyInstrumented = instrumented.replace(
      '// TEMPORARY ResumoFinanceiro OSLog diagnostics v3',
      '// TEMPORARY ResumoFinanceiro OSLog diagnostics',
    );

    expect(() => transformResumoFinanceiroWidgetSource(legacyInstrumented)).toThrow(
      'found legacy instrumentation',
    );
  });
});
