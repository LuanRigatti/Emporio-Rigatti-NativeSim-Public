import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Open Payments bulk payment integration boundaries', () => {
  const functionSource = readSource('functions/openPaymentBulkActions.js');
  const functionIndex = readSource('functions/index.js');
  const firestoreIndexes = JSON.parse(readSource('firestore.indexes.json')) as {
    indexes: { collectionGroup: string; fields: { fieldPath: string }[] }[];
  };
  const hook = readSource('src/features/open-payments/hooks/useOpenPaymentClients.ts');
  const cards = readSource('src/features/open-payments/components/OpenPaymentClientCards.tsx');
  const screen = readSource('src/features/open-payments/components/OpenPaymentClientsScreen.tsx');

  it('derives UID from callable authentication and queries only canonical eligible deliveries', () => {
    expect(functionIndex).toContain('exports.openPaymentBulkActions = onCall(');
    expect(functionSource).toContain('const uid = request?.auth?.uid');
    expect(functionSource).toContain(".where('clientId', '==', clientDocumentId)");
    expect(functionSource).toContain(".where('status', '==', DELIVERY_STATUS_OPEN)");
    expect(functionSource).toContain(".where('delivered', '==', true)");
    expect(functionSource).not.toContain('request.data.uid');
  });

  it('revalidates the exact set and atomically writes status, timestamp, and protected receipt', () => {
    expect(functionSource).toContain('await firestore.runTransaction');
    expect(functionSource).toContain('summary.snapshotFingerprint !== snapshotFingerprint');
    expect(functionSource).toContain("status: 'Pago'");
    expect(functionSource).toContain('updatedAt: serverTimestamp()');
    expect(functionSource).toContain('transaction.create(receiptRef');
    expect(functionSource).not.toContain('paymentMethod:');
    expect(functionSource).toContain('const MAX_BULK_DELIVERIES = 499');
  });

  it('requires one canonical visible identity and keeps individual payment actions', () => {
    expect(cards).toContain('getUnambiguousCanonicalClientId(client.deliveries)');
    expect(cards).toContain("title: 'Todos pagos'");
    expect(cards).toContain('onMarkAsPaid(delivery.id)');
    expect(hook).toContain("editMany([deliveryId], { status: 'Pago' })");
    expect(screen).toContain('Marcar todas como pagas?');
    expect(screen).toContain("preview.status === 'presentation-mismatch'");
  });

  it('declares the composite index required by the authoritative query', () => {
    expect(
      firestoreIndexes.indexes.some(
        (index) =>
          index.collectionGroup === 'deliveries' &&
          ['clientId', 'status', 'delivered'].every((field) =>
            index.fields.some(({ fieldPath }) => fieldPath === field),
          ),
      ),
    ).toBe(true);
  });
});
