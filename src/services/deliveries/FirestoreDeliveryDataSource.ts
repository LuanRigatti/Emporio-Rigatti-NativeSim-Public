import type {
  Delivery,
  DeliveryBulkPatch,
  DeliveryDraft,
  DeliveryFilters,
  InvoiceStatus,
  PaymentMethod,
} from '@/types/data';
import { deliveryQueryService } from './DeliveryQueryService';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';
import { todayIso } from '@/utils/data';

import { createDeliveryFromDraft } from './deliveryRecord';
import { mockDeliveryDataSource } from './DeliveryDataSource';
import { firestoreDeliveryCacheService } from './FirestoreDeliveryCacheService';

type FirestoreDeliveryDocument = {
  clientId: string;
  clientNameSnapshot: string;
  addressSnapshot?: string;
  date: string;
  quantity: number;
  unitPriceHistorical?: number;
  totalValue: number;
  status: string;
  delivered: boolean;
  invoiceStatus?: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  observation?: string;
  legacyFields?: Record<string, unknown>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type Listener = () => void;

async function collectionFor(uid: string) {
  const { collection } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'deliveries');
}

function mapDocument(id: string, value: FirestoreDeliveryDocument): Delivery {
  return {
    id,
    ...(value.clientId ? { clientId: `client:${value.clientId}` } : {}),
    cliente: value.clientNameSnapshot,
    quantidade: value.quantity,
    valor: value.totalValue,
    precoUnitarioHistorico: value.unitPriceHistorical,
    status: value.status,
    entregue: value.delivered,
    data: value.date,
    invoiceStatus: value.invoiceStatus,
    endereco: value.addressSnapshot,
    metodoPagamento: value.paymentMethod,
    observacao: value.observation,
    legacyFields: value.legacyFields,
  };
}

function toDocument(delivery: Delivery): FirestoreDeliveryDocument {
  if (!delivery.clientId?.startsWith('client:')) {
    throw new Error('Selecione um cliente Firestore válido.');
  }
  return {
    clientId: delivery.clientId.slice('client:'.length),
    clientNameSnapshot: delivery.cliente,
    ...(delivery.endereco ? { addressSnapshot: delivery.endereco } : {}),
    date: delivery.data,
    quantity: delivery.quantidade,
    totalValue: delivery.valor,
    status: delivery.status,
    delivered: delivery.entregue,
    ...(delivery.precoUnitarioHistorico === undefined
      ? {}
      : { unitPriceHistorical: delivery.precoUnitarioHistorico }),
    ...(delivery.invoiceStatus ? { invoiceStatus: delivery.invoiceStatus } : {}),
    ...(delivery.metodoPagamento ? { paymentMethod: delivery.metodoPagamento } : {}),
    ...(delivery.observacao ? { observation: delivery.observacao } : {}),
    ...(delivery.legacyFields ? { legacyFields: delivery.legacyFields } : {}),
  };
}

export class FirestoreDeliveryDataSource {
  public isUsingLocalFallback = false;
  private readonly records = new Map<string, Delivery>();
  private readonly listeners = new Set<Listener>();
  private activeUid?: string;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getCached(filters: DeliveryFilters): Delivery[] {
    const bounded = [...this.records.values()].filter((delivery) => {
      if (filters.date && delivery.data !== filters.date) return false;
      if (filters.startDate && delivery.data < filters.startDate) return false;
      if (filters.endDate && delivery.data > filters.endDate) return false;
      if (filters.clientId && delivery.clientId !== filters.clientId) return false;
      if (
        filters.clientIds &&
        (!delivery.clientId || !filters.clientIds.includes(delivery.clientId))
      ) {
        return false;
      }
      if (filters.status && filters.status !== 'Todos' && delivery.status !== filters.status) {
        return false;
      }
      return true;
    });
    return deliveryQueryService.filter(bounded, filters);
  }

  public async hydrateFromCache(uid: string, date = todayIso()): Promise<boolean> {
    if (this.activeUid && this.activeUid !== uid) this.records.clear();
    this.activeUid = uid;

    const cached = await firestoreDeliveryCacheService.read(uid, date);
    for (const [id, delivery] of this.records) {
      if (delivery.data === date) this.records.delete(id);
    }
    cached?.forEach((delivery) => this.records.set(delivery.id, delivery));
    this.publish();
    return cached !== null;
  }

  public async load(uid: string, filters: DeliveryFilters): Promise<Delivery[]> {
    if (filters.clientIds && filters.clientIds.length === 0) {
      return [];
    }
    if (!this.hasBoundedQuery(filters)) {
      return [];
    }
    try {
      if (this.activeUid && this.activeUid !== uid) this.records.clear();
      this.activeUid = uid;
      const { doc, getDoc, getDocs, query, where } = await import('firebase/firestore');
      const deliveryCollection = await collectionFor(uid);
      const constraints: Parameters<typeof query>[1][] = [];
      const loaded: Delivery[] = [];
      if (filters.deliveryId) {
        const result = await getDoc(doc(deliveryCollection, filters.deliveryId));
        const mapped = result.exists()
          ? mapDocument(result.id, result.data() as FirestoreDeliveryDocument)
          : null;
        if (mapped) loaded.push(mapped);
      } else if (filters.deliveryIds?.length) {
        const results = await Promise.all(
          filters.deliveryIds.map((id) => getDoc(doc(deliveryCollection, id))),
        );
        results.forEach((result) => {
          if (result.exists()) {
            const mapped = mapDocument(result.id, result.data() as FirestoreDeliveryDocument);
            loaded.push(mapped);
          }
        });
      } else {
        if (filters.date) constraints.push(where('date', '==', filters.date));
        if (filters.startDate) constraints.push(where('date', '>=', filters.startDate));
        if (filters.endDate) constraints.push(where('date', '<=', filters.endDate));
        if (filters.clientId?.startsWith('client:')) {
          constraints.push(where('clientId', '==', filters.clientId.slice('client:'.length)));
        }
        if (filters.status && filters.status !== 'Todos') {
          constraints.push(where('status', '==', filters.status));
        }
        const clientDocumentIds = filters.clientIds
          ?.filter((clientId) => clientId.startsWith('client:'))
          .map((clientId) => clientId.slice('client:'.length));
        const clientIdChunks = filters.clientIds
          ? clientDocumentIds?.length
            ? chunk(clientDocumentIds, 30)
            : []
          : [undefined];
        const results = await Promise.all(
          clientIdChunks.map((clientIds) =>
            getDocs(
              query(
                deliveryCollection,
                ...constraints,
                ...(clientIds ? [where('clientId', 'in', clientIds)] : []),
              ),
            ),
          ),
        );
        results.forEach((result) => {
          result.docs.forEach((item) => {
            loaded.push(mapDocument(item.id, item.data() as FirestoreDeliveryDocument));
          });
        });
      }
      this.replaceDateRecords(filters);
      loaded.forEach((delivery) => this.records.set(delivery.id, delivery));
      this.isUsingLocalFallback = false;
      this.publish();
      const result = this.getCached(filters);
      if (filters.date) void this.persistDateCache(uid, filters.date);
      return result;
    } catch (error) {
      this.isUsingLocalFallback = true;
      throw error;
    }
  }

  public async create(uid: string, draft: DeliveryDraft): Promise<Delivery> {
    if (this.isUsingLocalFallback)
      return mockDeliveryDataSource.createFromRegistration({
        clientName: draft.clientName,
        date: new Date(`${draft.date}T12:00:00`),
        quantity: draft.quantity,
        bucketPrice: draft.historicalUnitPrice ?? draft.value / draft.quantity,
      });
    const delivery = createDeliveryFromDraft(draft);
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    const reference = doc(await collectionFor(uid));
    await setDoc(reference, { ...toDocument(delivery), createdAt: serverTimestamp() });
    const created = { ...delivery, id: reference.id };
    this.activeUid = uid;
    this.records.set(created.id, created);
    this.publish();
    void this.persistDateCache(uid, created.data);
    void financialPeriodSnapshotCache.invalidate(uid, created.data.slice(0, 7));
    return created;
  }

  public async update(uid: string, deliveryId: string, draft: DeliveryDraft): Promise<Delivery> {
    const previous = this.records.get(deliveryId);
    if (!previous) {
      await this.load(uid, { mode: 'all', deliveryId });
    }
    const current = this.records.get(deliveryId);
    if (!current) throw new Error('Entrega não encontrada.');
    const delivery = createDeliveryFromDraft(
      { ...draft, id: deliveryId, clientId: draft.clientId ?? current.clientId },
      current,
    );
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(await collectionFor(uid), deliveryId),
      {
        ...toDocument(delivery),
        updatedAt: (await import('firebase/firestore')).serverTimestamp(),
      },
      { merge: true },
    );
    this.records.set(deliveryId, delivery);
    this.publish();
    void this.persistDateCache(uid, current.data);
    if (current.data !== delivery.data) void this.persistDateCache(uid, delivery.data);
    void financialPeriodSnapshotCache.invalidate(uid, delivery.data.slice(0, 7));
    if (current.data.slice(0, 7) !== delivery.data.slice(0, 7)) {
      void financialPeriodSnapshotCache.invalidate(uid, current.data.slice(0, 7));
    }
    return delivery;
  }

  public async remove(uid: string, deliveryId: string): Promise<void> {
    const previous = this.records.get(deliveryId);
    const { deleteDoc, doc } = await import('firebase/firestore');
    await deleteDoc(doc(await collectionFor(uid), deliveryId));
    this.records.delete(deliveryId);
    this.publish();
    if (previous) void this.persistDateCache(uid, previous.data);
    if (previous) void financialPeriodSnapshotCache.invalidate(uid, previous.data.slice(0, 7));
  }

  public async toggleDelivered(uid: string, deliveryId: string): Promise<void> {
    const current = await this.ensure(uid, deliveryId);
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(await collectionFor(uid), deliveryId), {
      delivered: !current.entregue,
      updatedAt: serverTimestamp(),
    });
    this.records.set(deliveryId, { ...current, entregue: !current.entregue });
    this.publish();
    void this.persistDateCache(uid, current.data);
    void financialPeriodSnapshotCache.invalidate(uid, current.data.slice(0, 7));
  }

  public async updateInvoiceStatus(
    uid: string,
    deliveryId: string,
    status: InvoiceStatus,
  ): Promise<void> {
    const current = await this.ensure(uid, deliveryId);
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(await collectionFor(uid), deliveryId), {
      invoiceStatus: status,
      updatedAt: serverTimestamp(),
    });
    this.records.set(deliveryId, { ...current, invoiceStatus: status });
    this.publish();
    void this.persistDateCache(uid, current.data);
    void financialPeriodSnapshotCache.invalidate(uid, current.data.slice(0, 7));
  }

  public async settle(
    uid: string,
    deliveryIds: readonly string[],
    method: PaymentMethod,
  ): Promise<void> {
    if (!deliveryIds.length) throw new Error('Selecione ao menos uma entrega para quitar.');
    if (!['Dinheiro', 'Pix'].includes(method))
      throw new Error('Escolha Dinheiro ou Pix para quitar as entregas.');
    await Promise.all(
      deliveryIds.map(async (id) => {
        const current = await this.ensure(uid, id);
        if (current.status === 'Pago' || !current.entregue)
          throw new Error('Somente entregas não pagas e entregues podem ser quitadas.');
        const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(await collectionFor(uid), id), {
          status: 'Pago',
          paymentMethod: method,
          updatedAt: serverTimestamp(),
        });
        this.records.set(id, { ...current, status: 'Pago', metodoPagamento: method });
        void financialPeriodSnapshotCache.invalidate(uid, current.data.slice(0, 7));
      }),
    );
    this.publish();
    [...new Set(deliveryIds.map((id) => this.records.get(id)?.data))]
      .filter((date): date is string => Boolean(date))
      .forEach((date) => void this.persistDateCache(uid, date));
  }

  public async editMany(
    uid: string,
    ids: readonly string[],
    patch: DeliveryBulkPatch,
  ): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        const current = await this.ensure(uid, id);
        const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(await collectionFor(uid), id), {
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.entregue === undefined ? {} : { delivered: patch.entregue }),
          ...(patch.invoiceStatus ? { invoiceStatus: patch.invoiceStatus } : {}),
          updatedAt: serverTimestamp(),
        });
        this.records.set(id, { ...current, ...patch });
        void financialPeriodSnapshotCache.invalidate(uid, current.data.slice(0, 7));
      }),
    );
    this.publish();
    [...new Set(ids.map((id) => this.records.get(id)?.data))]
      .filter((date): date is string => Boolean(date))
      .forEach((date) => void this.persistDateCache(uid, date));
  }

  private async ensure(uid: string, id: string): Promise<Delivery> {
    const cached = this.records.get(id);
    if (cached) return cached;
    await this.load(uid, { mode: 'all', deliveryId: id });
    const loaded = this.records.get(id);
    if (!loaded) throw new Error('Entrega não encontrada.');
    return loaded;
  }

  private hasBoundedQuery(filters: DeliveryFilters): boolean {
    return Boolean(
      filters.date ||
      filters.startDate ||
      filters.endDate ||
      filters.deliveryId ||
      filters.deliveryIds?.length ||
      filters.clientId ||
      filters.clientIds?.length ||
      (filters.status && filters.status !== 'Todos'),
    );
  }

  private replaceDateRecords(filters: DeliveryFilters): void {
    if (!filters.date && !filters.startDate && !filters.endDate) return;

    for (const [id, delivery] of this.records) {
      const matchesDate = filters.date
        ? delivery.data === filters.date
        : (!filters.startDate || delivery.data >= filters.startDate) &&
          (!filters.endDate || delivery.data <= filters.endDate);
      if (matchesDate) this.records.delete(id);
    }
  }

  private async persistDateCache(uid: string, date: string): Promise<void> {
    try {
      const deliveries = [...this.records.values()].filter((delivery) => delivery.data === date);
      await firestoreDeliveryCacheService.write(uid, date, deliveries);
    } catch {
      // The cache is an optimization; Firestore remains the source of truth.
    }
  }

  private publish(): void {
    this.listeners.forEach((listener) => listener());
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export const firestoreDeliveryDataSource = new FirestoreDeliveryDataSource();
