import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('History screen presentation', () => {
  const historyScreenSource = readFileSync(
    resolve(process.cwd(), 'src/features/history/components/HistoryScreen.tsx'),
    'utf8',
  );

  it('replaces the daily list by date and fades the list as one opacity-only group', () => {
    const dailyRender =
      historyScreenSource
        .split('const renderDayContent')[1]
        ?.split('const renderGroupedContent')[0] ?? '';

    expect(dailyRender).not.toBe('');
    expect(dailyRender).toContain('key={delivery.id}');
    expect(dailyRender).toContain('<DeliveryCard');
    expect(dailyRender).toContain('key={selectedDate}');
    expect(dailyRender).toContain('entering={FadeIn.duration(reduceMotionEnabled ? 0 : 150)}');
    expect(dailyRender).toContain('<Animated.View');
    expect(dailyRender).not.toContain('FadeInDown');
    expect(dailyRender).not.toContain('exiting=');
    expect(dailyRender).not.toContain('layout=');
    expect(dailyRender).not.toContain('translateY');
    expect(dailyRender.match(/entering=/g)).toHaveLength(1);
  });
});
