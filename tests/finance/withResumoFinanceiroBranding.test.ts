const { transformResumoFinanceiroWidgetSource } = jest.requireActual(
  '../../plugins/withResumoFinanceiroBranding',
) as {
  transformResumoFinanceiroWidgetSource: (source: string) => string;
};

const generatedWidgetSource = [
  'import WidgetKit',
  'import SwiftUI',
  'import AppIntents',
  'internal import ExpoWidgets',
  '',
  'struct ResumoFinanceiroEntryView: View {',
  '  private var widgetEnvironment: [String: Any] {',
  '    var env: [String: Any] = getWidgetEnvironment(environment: environment)',
  '    env["timestamp"] = Int(entry.date.timeIntervalSince1970 * 1000)',
  '    return env',
  '  }',
  '}',
].join('\n');

describe('ResumoFinanceiro branding CNG transform', () => {
  it('adds the app-group image directory to the widget environment', () => {
    const transformed = transformResumoFinanceiroWidgetSource(generatedWidgetSource);

    expect(transformed).toContain('import Foundation');
    expect(transformed).toContain('// ResumoFinanceiro shared branding image directory');
    expect(transformed).toContain('env["widgetsDirectory"] =');
    expect(transformed).toContain('forSecurityApplicationGroupIdentifier: appGroupIdentifier');
  });

  it('is idempotent when CNG applies the transform repeatedly', () => {
    const once = transformResumoFinanceiroWidgetSource(generatedWidgetSource);

    expect(transformResumoFinanceiroWidgetSource(once)).toBe(once);
  });

  it('fails clearly when the expected Expo Widgets layout anchor is missing', () => {
    expect(() =>
      transformResumoFinanceiroWidgetSource(generatedWidgetSource.replace('import SwiftUI\n', '')),
    ).toThrow('expected exactly one Foundation import insertion point; found 0');
  });
});
