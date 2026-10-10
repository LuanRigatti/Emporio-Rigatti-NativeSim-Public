const { transformResumoFinanceiroWidgetSource } = jest.requireActual<{
  transformResumoFinanceiroWidgetSource: (source: string) => string;
}>('../../plugins/withResumoFinanceiroDiagnostics');

const generatedWidgetSource = [
  'import WidgetKit',
  'import SwiftUI',
  'import AppIntents',
  'internal import ExpoWidgets',
  '',
  'struct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
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
  '  var entry: ResumoFinanceiroTimelineProvider.Entry',
  '  private var widgetEnvironment: [String: Any] { ["configuration": ["mode": "wholesale"]] }',
  '  public var body: some View {',
  '    if let layout = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout"),',
  '       !layout.isEmpty {',
  '      let node = evaluateLayout(layout: layout, props: entry.props ?? [:], environment: widgetEnvironment)',
  '      WidgetsDynamicView(name: entry.name, kind: .widget, node: node, entryIndex: entry.entryIndex, environmentString: nil)',
  '    } else {',
  '      WidgetsDynamicView(name: entry.name, kind: .widget, node: createRedBox(message: "No layout"), entryIndex: entry.entryIndex, environmentString: nil)',
  '    }',
  '  }',
  '}',
].join('\n');

describe('ResumoFinanceiro diagnostics CNG plugin', () => {
  it('adds provider and layout events and remains idempotent', () => {
    const instrumented = transformResumoFinanceiroWidgetSource(generatedWidgetSource);
    const viewBuilderBody = instrumented.match(
      /  public var body: some View \{\n([\s\S]*?)\n  \}\n\}/,
    )?.[1];

    expect(instrumented).toContain('category: "RigattiWidgetSync"');
    expect(instrumented).toContain('event=timeline_read source=extension raw_count=');
    expect(instrumented).toContain(
      '    resumoFinanceiroDiagnosticsLogger.info("event=timeline_read source=extension',
    );
    expect(viewBuilderBody).toBeDefined();
    expect(
      viewBuilderBody?.match(/let _ = resumoFinanceiroDiagnosticsLogger\.info\(/g),
    ).toHaveLength(3);
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=start');
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=returned');
    expect(viewBuilderBody).toContain('event=layout_evaluation phase=layout_missing');
    expect(viewBuilderBody).not.toMatch(/^\s*resumoFinanceiroDiagnosticsLogger\.info\(/m);
    expect(transformResumoFinanceiroWidgetSource(instrumented)).toBe(instrumented);
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
});
