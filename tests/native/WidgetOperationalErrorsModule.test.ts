import fs from 'node:fs';
import path from 'node:path';

const moduleSource = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'modules/native-widget-operational-errors/ios/NativeWidgetOperationalErrorsModule.swift',
  ),
  'utf8',
);

describe('native widget operational error logging', () => {
  it('writes only allowlisted publication failures to OSLog at error level', () => {
    expect(moduleSource).toContain('category: "WidgetOperationalErrors"');
    expect(moduleSource).toContain('Function("recordFailure")');
    expect(moduleSource).toContain('self.logger.error(');
    expect(moduleSource).toContain('guard safeEvents.contains(event), safeStages.contains(stage)');
    expect(moduleSource).toContain('delivery_timeline_publish_failed');
    expect(moduleSource).toContain('finance_widget_module_load_failed');
    expect(moduleSource).not.toMatch(/\.info\(|\.debug\(|timeline_read|publish_start/);
    expect(moduleSource).not.toMatch(
      /localizedDescription|clientName|deliveryId|sessionId|token|capability/i,
    );
  });
});
