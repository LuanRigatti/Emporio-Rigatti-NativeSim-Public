import {
  canStartFirebaseReadOnlyPhase,
  FIREBASE_SCHEMA_CONTRACTS,
  getFirebaseActivationReadiness,
} from '@/services/data/FirebaseActivationGate';
import { FirebaseDataValidationService } from '@/services/data/FirebaseDataValidationService';
import { assertFirebaseUid, userNodePath } from '@/services/data/paths';
import type { UserDataSnapshot } from '@/services/data/UserDataSnapshot';

function validSnapshot(): UserDataSnapshot {
  return {
    clientesCustom: { Ana: { nome: 'Ana', preco: 49.8 } },
    entregas: [
      {
        id: 'delivery-1',
        cliente: 'Ana',
        quantidade: 2,
        valor: 99.6,
        precoUnitarioHistorico: 49.8,
        status: 'NÃ£o Pago',
        entregue: true,
        data: '2026-08-06',
      },
    ],
    gastosDiarios: {
      '2026-08-06': {
        data: '2026-08-06',
        estar: 10,
        gasolina: 20,
        km: 90,
        precoGasolina: 5.69,
        tipoCombustivel: 'gasolina',
      },
    },
    gastosMensais: { '2026-08': { luz: 100 } },
    recebimentoBaldes: [
      {
        id: 'receipt-1',
        quantidade: 10,
        data: '2026-08-01',
        valorTotal: 350,
        concluido: false,
        pagamentos: [{ id: 'payment-1', data: '2026-08-02', valor: 100 }],
      },
    ],
    pushToken: undefined,
  };
}

describe('Firebase final activation gate', () => {
  it('is ready only for read-only activation and keeps writes disabled', () => {
    const report = getFirebaseActivationReadiness();

    expect(report.status).toBe('READY_FOR_READ_ONLY_FIREBASE');
    expect(report.blockers).toEqual([]);
    expect(report.flags.enableFirebaseAuth).toBe(false);
    expect(report.flags.enableFirebaseAppData).toBe(false);
    expect(report.flags.enableFirebaseWrites).toBe(false);
    expect(report.rollback.ready).toBe(true);
    expect(canStartFirebaseReadOnlyPhase()).toBe(true);
  });

  it('documents only the prepared Firebase nodes', () => {
    expect(FIREBASE_SCHEMA_CONTRACTS.map((contract) => contract.firebasePath)).toEqual([
      'Firebase Auth user',
      'usuarios/{uid}/clientesCustom',
      'usuarios/{uid}/entregas',
      'usuarios/{uid}/recebimentoBaldes',
      'usuarios/{uid}/gastosDiarios',
      'usuarios/{uid}/gastosMensais',
      'usuarios/{uid}/pushToken',
      'usuarios/{uid}/stockSnapshots/{yyyy-MM}',
    ]);
    expect(FIREBASE_SCHEMA_CONTRACTS.at(-1)?.writeEnabled).toBe(false);
  });

  it('rejects the mock uid from Firebase-scoped paths', () => {
    expect(() => assertFirebaseUid('mock-user-1')).toThrow();
    expect(() => userNodePath('mock-user-1', 'entregas')).toThrow();
    expect(userNodePath('firebase-user-1', 'entregas')).toBe('usuarios/firebase-user-1/entregas');
  });
});

describe('Firebase data validation', () => {
  it('accepts valid historical values and nested partial payments', () => {
    expect(
      new FirebaseDataValidationService().validate(validSnapshot(), {
        recognizedClientNames: ['Ana'],
      }),
    ).toEqual([]);
  });

  it('reports duplicate ids, invalid dates, negative quantities and unknown clients', () => {
    const snapshot = validSnapshot();
    snapshot.entregas = [
      ...snapshot.entregas,
      { ...snapshot.entregas[0]!, data: 'not-a-date', quantidade: -1 },
    ];

    const issues = new FirebaseDataValidationService().validate(snapshot, {
      recognizedClientNames: ['Carlos'],
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate-id',
        'invalid-date',
        'negative-quantity',
        'unrecognized-client',
      ]),
    );
  });

  it('reports payments above the purchase total and historical mismatches', () => {
    const snapshot = validSnapshot();
    snapshot.recebimentoBaldes[0]!.pagamentos.push({
      id: 'payment-2',
      data: '2026-08-03',
      valor: 300,
    });
    snapshot.entregas[0] = { ...snapshot.entregas[0]!, precoUnitarioHistorico: 40 };

    const issues = new FirebaseDataValidationService().validate(snapshot);

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['payment-over-total', 'historical-value-mismatch']),
    );
  });
});
