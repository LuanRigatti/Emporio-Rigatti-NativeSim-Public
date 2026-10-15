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

  it('captures privacy-safe delivery snapshot markers under the app-owned subsystem', () => {
    expect(moduleSource).toContain('private let deliveryLogger = os.Logger(');
    expect(moduleSource).toContain('category: "DeliveryWidgetSnapshot"');
    expect(moduleSource).toContain('Function("deliverySnapshotEvent")');
    expect(moduleSource).toContain('let safeEvents = [');
    expect(moduleSource).toContain('"snapshot_unavailable"');
    expect(moduleSource).toContain(
      'let safeStates = ["pending", "all_completed", "empty", "unavailable"]',
    );
    expect(moduleSource).toContain('max(0, min(deliveryCount, 1000))');
    expect(moduleSource).toContain('delivery_count=');
    expect(moduleSource).not.toMatch(
      /deliverySnapshotEvent[\s\S]{0,900}(?:uid|deliveryId|sessionId|token|capability|clientName|valueLabel)/i,
    );
  });
});
