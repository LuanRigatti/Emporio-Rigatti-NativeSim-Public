import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const historySource = readFileSync(
  resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderHistoryScreen.tsx'),
  'utf8',
);

describe('RetailOrderHistoryScreen presentation contract', () => {
  it('uses one tokenized date heading style for Dia, Semana and Mês', () => {
    const contentStart = historySource.lastIndexOf('  const dateHeadingStyle = [');
    const contentBlock = historySource.slice(
      contentStart,
      historySource.indexOf('  return (', contentStart),
    );

    expect(contentBlock).toContain('const dateHeadingStyle = [');
    expect(contentBlock).toContain('formatHistoryDayHeading(selectedRange.startDate)');
    expect(contentBlock).toContain('marginLeft: theme.spacing.xs');
    expect(contentBlock).toContain('formatHistoryDayHeading(group.date)');
    expect(contentBlock.match(/style=\{dateHeadingStyle\}/g)).toHaveLength(2);
  });
});
