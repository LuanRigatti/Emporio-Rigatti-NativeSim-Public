import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const moduleSource = fs.readFileSync(
  path.join(repoRoot, 'modules/native-widget-diagnostics/ios/NativeWidgetDiagnosticsModule.swift'),
  'utf8',
);

describe('shared native widget diagnostics module', () => {
  it('keeps the OSLog Logger explicitly qualified', () => {
    expect(moduleSource).toContain('private let logger = os.Logger(');
    expect(moduleSource).not.toMatch(/(?:=|:\s*)Logger\b/);
  });
});
