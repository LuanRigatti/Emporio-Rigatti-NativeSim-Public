import type { BackupData } from '@/types/data';
import { backupMergeService } from '@/services/backup/BackupMergeService';
import {
  backupIntegrityService,
  backupDataFromSnapshot,
} from '@/services/backup/BackupIntegrityService';
import { backupValidationService } from '@/services/backup/BackupValidationService';
import type { UserDataSnapshot } from '@/services/data';

const delivery = (id: string, value = 20) => ({
  cliente: 'Cliente Teste',
  data: '2026-07-25',
  entregue: false,
  id,
  quantidade: 2,
  status: 'Não Pago',
  valor: value,
});

const receipt = (id: string) => ({
  concluido: false,
  data: '2026-07-25',
  id,
  pagamentos: [],
  quantidade: 10,
  valorTotal: 100,
});

describe('BackupValidationService', () => {
  it('accepts the canonical backup and counts all records', () => {
    const result = backupValidationService.parse(
      JSON.stringify({
        clientesCustom: { Personalizado: { endereco: 'Rua A', preco: 15 } },
        entregas: [delivery('delivery-1')],
        gastosDiarios: { '2026-07-25': { estar: 10, km: 20 } },
        gastosMensais: { '2026-07': 300 },
        recebimentoBaldes: [receipt('receipt-1')],
      }),
    );

    expect(result.preview).toMatchObject({
      customClients: 1,
      dailyExpenses: 1,
      deliveries: 1,
      factoryPayments: 0,
      factoryReceipts: 1,
      monthlyExpenses: 1,
      sourceFormat: 'canonical',
    });
  });

  it('accepts a legacy array containing only deliveries', () => {
    const result = backupValidationService.parse(JSON.stringify([delivery('legacy-1')]));

    expect(result.data.entregas).toHaveLength(1);
    expect(result.data.recebimentoBaldes).toEqual([]);
    expect(result.preview.sourceFormat).toBe('legacy-deliveries-array');
  });

  it('normalizes legacy delivery aliases and generates a stable id when absent', () => {
    const result = backupValidationService.parse(
      JSON.stringify([
        {
          data: '25/07/2026',
          entregue: false,
          nome: 'Cliente Legado',
          quantidade: 2,
          status: 'Não Pago',
          valorTotal: 'R$ 20,00',
        },
      ]),
    );

    expect(result.data.entregas[0]).toMatchObject({
      cliente: 'Cliente Legado',
      valor: 20,
    });
    expect(result.data.entregas[0]?.id).toMatch(/^legacy-0-/);
    expect(result.preview.warnings).toContain(
      '1 entrega(s) sem id receberam identificador compatível.',
    );
  });

  it('maps recebimentosFabrica to the canonical recebimentoBaldes field', () => {
    const result = backupValidationService.parse(
      JSON.stringify({ recebimentosFabrica: [receipt('legacy-receipt')] }),
    );

    expect(result.data.recebimentoBaldes).toHaveLength(1);
    expect(result.preview.sourceFormat).toBe('legacy-factory-alias');
    expect(result.preview.warnings).toContain(
      'O campo legado recebimentosFabrica foi convertido para recebimentoBaldes.',
    );
  });

  it('rejects invalid JSON and unknown root objects', () => {
    expect(() => backupValidationService.parse('{')).toThrow('JSON válido');
    expect(() => backupValidationService.parse(JSON.stringify({ other: [] }))).toThrow(
      'nenhuma coleção de backup reconhecida',
    );
  });
});

describe('BackupMergeService', () => {
  const current: BackupData = {
    clientesCustom: { Atual: { nome: 'Atual', preco: 20 } },
    entregas: [delivery('same', 20)],
    gastosDiarios: {},
    gastosMensais: {},
    recebimentoBaldes: [receipt('receipt-1')],
  };

  it('adds new records and preserves conflicting records', () => {
    const parsed = backupValidationService.parse(
      JSON.stringify({
        clientesCustom: { Atual: { preco: 30 } },
        entregas: [delivery('same', 25), delivery('new')],
        gastosDiarios: {},
        gastosMensais: {},
        recebimentoBaldes: [receipt('receipt-1')],
      }),
    );

    const result = backupMergeService.merge(current, {
      data: parsed.data,
      fileName: 'backup.json',
      preview: parsed.preview,
    });

    expect(result.data.entregas.map((item) => item.id)).toEqual(['same', 'new']);
    expect(result.data.entregas[0]?.valor).toBe(20);
    expect(result.imported.deliveries).toBe(1);
    expect(result.conflicts).toHaveLength(2);
  });
});

describe('BackupIntegrityService', () => {
  it('compares the backup data without including pushToken', () => {
    const snapshot: UserDataSnapshot = {
      clientesCustom: {},
      entregas: [
        {
          ...delivery('delivery-1'),
          legacyFields: {},
        },
      ],
      gastosDiarios: {},
      gastosMensais: {},
      recebimentoBaldes: [],
      pushToken: 'ExpoPushToken[secret]',
    };

    expect(
      backupIntegrityService.verify(snapshot, {
        ...snapshot,
        pushToken: 'ExpoPushToken[other-device]',
      }),
    ).toBe(true);
    expect(backupDataFromSnapshot(snapshot)).not.toHaveProperty('pushToken');
  });
});
