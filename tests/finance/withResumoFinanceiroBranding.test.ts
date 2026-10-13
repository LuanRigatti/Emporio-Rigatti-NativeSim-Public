import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { transformExpoWidgetsTarget, transformResumoFinanceiroWidgetSource } = jest.requireActual(
  '../../plugins/withResumoFinanceiroBranding',
) as {
  transformExpoWidgetsTarget: (projectRoot: string) => void;
  transformResumoFinanceiroWidgetSource: (source: string) => string;
};

const widgetSourceNames = ['ResumoFinanceiro.swift', 'EntregasDoDia.swift'] as const;

function generatedWidgetSource(widgetName: string) {
  return [
    'import WidgetKit',
    'import SwiftUI',
    'import AppIntents',
    'internal import ExpoWidgets',
    '',
    `struct ${widgetName.replace('.swift', '')}EntryView: View {`,
    '  private var widgetEnvironment: [String: Any] {',
    '    var env: [String: Any] = getWidgetEnvironment(environment: environment)',
    '    env["timestamp"] = Int(entry.date.timeIntervalSince1970 * 1000)',
    '    return env',
    '  }',
    '}',
  ].join('\n');
}

let temporaryProjectRoot: string | undefined;

afterEach(() => {
  if (temporaryProjectRoot) {
    fs.rmSync(temporaryProjectRoot, { recursive: true, force: true });
    temporaryProjectRoot = undefined;
  }
});

function createGeneratedWidgetTarget(sourceNames: readonly string[]) {
  temporaryProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigatti-widget-branding-'));
  const targetDirectory = path.join(temporaryProjectRoot, 'ExpoWidgetsTarget');
  fs.mkdirSync(targetDirectory);
  for (const sourceName of sourceNames) {
    fs.writeFileSync(path.join(targetDirectory, sourceName), generatedWidgetSource(sourceName));
  }
  return targetDirectory;
}

describe('ResumoFinanceiro branding CNG transform', () => {
  it.each(widgetSourceNames)(
    'adds the App Group image directory to the %s widget environment',
    (widgetSourceName) => {
      const transformed = transformResumoFinanceiroWidgetSource(
        generatedWidgetSource(widgetSourceName),
      );

      expect(transformed).toContain('import Foundation');
      expect(transformed).toContain('// ResumoFinanceiro shared branding image directory');
      expect(transformed).toContain('env["widgetsDirectory"] =');
      expect(transformed).toContain('forSecurityApplicationGroupIdentifier: appGroupIdentifier');
    },
  );

  it('applies idempotently to both Swift files generated in ExpoWidgetsTarget', () => {
    const targetDirectory = createGeneratedWidgetTarget(widgetSourceNames);
    const projectRoot = path.dirname(targetDirectory);

    transformExpoWidgetsTarget(projectRoot);
    const firstPass = widgetSourceNames.map((name) =>
      fs.readFileSync(path.join(targetDirectory, name), 'utf8'),
    );
    transformExpoWidgetsTarget(projectRoot);
    const secondPass = widgetSourceNames.map((name) =>
      fs.readFileSync(path.join(targetDirectory, name), 'utf8'),
    );

    expect(firstPass).toEqual(secondPass);
    for (const source of secondPass) {
      expect(source).toContain('env["widgetsDirectory"] =');
    }
  });

  it('fails clearly when a configured widget Swift file was not generated', () => {
    const projectRoot = path.dirname(createGeneratedWidgetTarget(['ResumoFinanceiro.swift']));

    expect(() => transformExpoWidgetsTarget(projectRoot)).toThrow('EntregasDoDia.swift');
  });

  it('fails clearly when the expected Expo Widgets layout anchor is missing', () => {
    expect(() =>
      transformResumoFinanceiroWidgetSource(
        generatedWidgetSource('ResumoFinanceiro.swift').replace('import SwiftUI\n', ''),
      ),
    ).toThrow('expected exactly one Foundation import insertion point; found 0');
  });
});
