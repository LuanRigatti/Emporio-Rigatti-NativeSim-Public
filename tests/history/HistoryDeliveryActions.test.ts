import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Wholesale History completion context action', () => {
  it.each([
    ['full card', 'src/features/history/components/DeliveryCard.tsx'],
    ['compact card', 'src/features/history/components/HistoryCompactDeliveryCard.tsx'],
  ])('offers an idempotent completion action before delete in the %s', (_, path) => {
    const source = readSource(path);
    const completionAction = source.indexOf("title: 'Concluída'");
    const deleteAction = source.indexOf("title: 'Excluir'");

    expect(completionAction).toBeGreaterThanOrEqual(0);
    expect(deleteAction).toBeGreaterThan(completionAction);
    expect(source).toContain("delivery.status === 'pendente' && onMarkDelivered");
    expect(source).toContain("systemImage: 'checkmark.circle.fill'");
    expect(source).toContain('disabled: testModeEnabled');
    expect(source).toContain('onPress: onMarkDelivered');
    expect(source).toContain('destructive: true');
  });

  it('connects the screen action to set delivered true without changing the status badge toggle', () => {
    const source = readSource('src/features/history/components/HistoryScreen.tsx');
    const hookSource = readSource('src/hooks/useDeliveries.ts');

    expect(source).toContain('void setDelivered(deliveryId, true)');
    expect(source).toContain('onToggleStatus={() => handleToggleStatus(delivery.id)}');
    expect(source).toContain('onMarkDelivered={() => handleMarkDelivered(delivery.id)}');
    expect(hookSource).toContain(
      'firestoreDeliveryDataSource.setDelivered(user.id, deliveryId, delivered)',
    );
    expect(hookSource).toContain('service.setDelivered(deliveryId, delivered)');
  });

  it('opts into the same Wholesale calendar week for both toolbar label and filtered range', () => {
    const source = readSource('src/features/history/components/HistoryScreen.tsx');

    expect(source).toContain("viewMode === 'week' ? selectedWeek : getHistoryMonthRange");
    expect(source).toContain('weekSelection: selectedWeek');
  });
});
