import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const widgetSource = readFileSync(
  resolve(
    process.cwd(),
    'src/features/deliveries/liveActivity/WholesaleDeliveryLiveActivityWidget.tsx',
  ),
  'utf8',
);

describe('Wholesale delivery Live Activity presentation', () => {
  it('uses the shared Splash logo in compact, minimal, expanded, and Lock Screen presentations', () => {
    const dynamicIslandSource = widgetSource.slice(
      widgetSource.indexOf('compactLeading:'),
      widgetSource.indexOf('expandedBottom:'),
    );

    expect(widgetSource).toContain('wholesale-live-activity-mark.png');
    expect(dynamicIslandSource.match(/uiImage=\{liveActivityBrandMarkURI\}/g)).toHaveLength(3);
    expect(dynamicIslandSource).not.toContain('shippingbox.fill');
    expect(dynamicIslandSource).not.toContain('resumo-financeiro-mark-dark.png');
  });

  it('styles the expanded Dynamic Island without changing other presentation regions', () => {
    const expandedCenterSource = widgetSource.slice(
      widgetSource.indexOf('expandedCenter:'),
      widgetSource.indexOf('expandedLeading:'),
    );
    const expandedLeadingSource = widgetSource.slice(
      widgetSource.indexOf('expandedLeading:'),
      widgetSource.indexOf('expandedBottom:'),
    );
    const expandedBottomSource = widgetSource.slice(
      widgetSource.indexOf('expandedBottom:'),
      widgetSource.indexOf('\n  };', widgetSource.indexOf('expandedBottom:')),
    );

    expect(expandedCenterSource.match(/font\(\{ weight: 'bold', design: 'rounded', size: 34 \}\)/g)).toHaveLength(2);
    expect(expandedCenterSource).toContain('>Entregas</Text>');
    expect(expandedCenterSource).toContain('>Baldes</Text>');
    expect(expandedLeadingSource).toContain('uiImage={liveActivityBrandMarkURI}');
    expect(expandedLeadingSource).toContain("aspectRatio({ contentMode: 'fit' })");
    expect(expandedLeadingSource).toContain('frame({ width: 48, height: 48 })');
    expect(widgetSource).not.toContain('expandedTrailing:');
    expect(expandedBottomSource).toContain("gaugeStyle('linearCapacity')");
    expect(expandedBottomSource).toContain("tint('#CFEDE3')");
    expect(expandedBottomSource).not.toContain('#0A84FF');
    expect(expandedBottomSource).toContain('scaleEffect({ x: 1, y: 2 })');
    expect(expandedBottomSource).toContain('frame({ height: 9 })');
    expect(expandedBottomSource).toContain('{displayedCompletedCount} / {totalCount}');
  });

  it('renders the Lock Screen logo, progress title, and count in the banner', () => {
    const lockScreenSource = widgetSource.slice(
      widgetSource.indexOf('banner:'),
      widgetSource.indexOf('compactLeading:'),
    );

    expect(lockScreenSource).toContain('alignment="leading"');
    expect(lockScreenSource).toContain('padding({ horizontal: 14, vertical: 20 })');
    expect(lockScreenSource).toContain("frame({ maxWidth: Infinity, alignment: 'leading' })");
    expect(lockScreenSource).toContain('frame({ width: 42, height: 42 })');
    expect(lockScreenSource).toContain("aspectRatio({ contentMode: 'fit' })");
    expect(lockScreenSource.match(/uiImage=\{liveActivityBrandMarkURI\}/g)).toHaveLength(1);
    expect(lockScreenSource).not.toContain('{dateLabel}');
    expect(lockScreenSource).not.toContain('shippingbox.fill');
    expect(lockScreenSource).not.toContain('Atacado');
    expect(lockScreenSource).not.toContain('Baldes');
    expect(lockScreenSource).toContain('Entregas');
    expect(lockScreenSource).not.toContain('props.bucketCount');
    expect(lockScreenSource).not.toContain('props.deliveryCount');
    expect(lockScreenSource).toContain('alignment="center"');
    expect(lockScreenSource).toContain(
      "font({ weight: 'semibold', design: 'rounded', size: 12 })",
    );
    expect(lockScreenSource).toContain("font({ weight: 'medium', design: 'rounded', size: 11 })");
    expect(lockScreenSource.match(/lineLimit\(1\)/g)).toHaveLength(2);
    expect(lockScreenSource.match(/fixedSize\(\{ horizontal: true, vertical: false \}\)/g)).toHaveLength(2);
  });

  it('shows the real completed-to-total delivery progress below the Lock Screen metrics', () => {
    const lockScreenSource = widgetSource.slice(
      widgetSource.indexOf('banner:'),
      widgetSource.indexOf('compactLeading:'),
    );

    expect(widgetSource).toContain(
      'const progress = totalCount > 0 ? displayedCompletedCount / totalCount : 0;',
    );
    expect(widgetSource).toContain(
      'const progressCountLabel = `${displayedCompletedCount}/${totalCount}`;',
    );
    expect(widgetSource).not.toContain('progressPercent');
    expect(lockScreenSource).toContain('value={progress}');
    expect(lockScreenSource).toContain("gaugeStyle('linearCapacity')");
    expect(lockScreenSource).toContain("tint('#CFEDE3')");
    expect(lockScreenSource).toContain('scaleEffect({ x: 1, y: 2 })');
    expect(lockScreenSource).toContain('frame({ height: 9 })');
    expect(lockScreenSource).toContain('frame({ maxWidth: Infinity })');
    expect(lockScreenSource).toContain('{progressCountLabel}');
    expect(lockScreenSource.indexOf('Entregas')).toBeLessThan(
      lockScreenSource.indexOf('value={progress}'),
    );
    expect(lockScreenSource).not.toContain('%');
    expect(lockScreenSource).not.toContain('displayedCompletedCount} / {totalCount');
    expect(lockScreenSource.indexOf('value={progress}')).toBeLessThan(
      lockScreenSource.indexOf('{progressCountLabel}'),
    );
  });

  it('shows the data date only as a stale warning and keeps the new banner layout', () => {
    const lockScreenSource = widgetSource.slice(
      widgetSource.indexOf('banner:'),
      widgetSource.indexOf('compactLeading:'),
    );

    expect(widgetSource).toContain('const isStale = props.isObsolete || environment.isStale;');
    expect(widgetSource).toContain(
      'const freshnessLabel = `Dados desatualizados · ${dateLabel}`;',
    );
    expect(lockScreenSource).toContain('{isStale ? (');
    expect(lockScreenSource).toContain('{freshnessLabel}');
    expect(lockScreenSource.indexOf('{freshnessLabel}')).toBeGreaterThan(
      lockScreenSource.indexOf('{progressCountLabel}'),
    );
    expect(lockScreenSource).not.toContain('Atacado');
    expect(lockScreenSource).not.toContain('props.bucketCount');
    expect(lockScreenSource).not.toContain('props.deliveryCount');
  });
});
