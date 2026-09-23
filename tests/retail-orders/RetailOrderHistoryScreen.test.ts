import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const historySource = readFileSync(
  resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderHistoryScreen.tsx'),
  'utf8',
);
const historyHookSource = readFileSync(
  resolve(process.cwd(), 'src/hooks/useRetailOrderHistory.ts'),
  'utf8',
);

describe('RetailOrderHistoryScreen presentation contract', () => {
  it('uses a friendly refresh warning without exposing the Firestore error message', () => {
    expect(historySource).toContain(
      'Não foi possível atualizar o histórico agora. Os pedidos já carregados continuam disponíveis.',
    );
    expect(historySource).not.toContain('Atualização do Histórico Varejo indisponível: {error}');
  });

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

  it('shows structural loading only while there is no usable snapshot', () => {
    expect(historySource).toContain('if (loading) {');
    expect(historySource).toContain('label="Carregando pedidos Varejo…"');
    expect(historySource).not.toContain('loading || refreshing');
  });

  it('delegates the initial load to focus revalidation without a duplicate hook load', () => {
    expect(historyHookSource).not.toContain('void Promise.resolve().then(() => load());');
    expect(historySource).toContain('void reload();');
  });

  it('exposes destructive order deletion through native menu and confirmation dialog', () => {
    const cardSource = readFileSync(
      resolve(process.cwd(), 'src/features/retail-orders/components/RetailOrderHistoryCard.tsx'),
      'utf8',
    );

    expect(cardSource).toContain('NativeCardContextMenu');
    expect(cardSource).toContain("title: 'Excluir'");
    expect(cardSource).toContain("systemImage: 'trash'");
    expect(historySource).toContain('<NativeDialog');
    expect(historySource).toContain('title="Excluir pedido?"');
    expect(historySource).toContain(
      'Esta ação removerá o pedido e seus pagamentos e não poderá ser desfeita.',
    );
  });

  it('keeps deletion presentation local and uses the hook mutation', () => {
    expect(historySource).toContain('remove(orderId)');
    expect(historySource).toContain('Não foi possível excluir o pedido agora. Tente novamente.');
    expect(historyHookSource).toContain('retailOrderDataSource.deleteOrder');
  });
});
