import type { DailyExpense, DailyExpenses, MonthlyExpense, MonthlyExpenses } from '@/types/data';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';

import type { CostField, CostPeriod, CostSettings, CostValues } from './CostSettingsStorage';

export type DailyMonthlyQuery = {
  date?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  loadAll?: boolean;
};

export type FirestoreDailyDocument = {
  data: string;
  estar?: number;
  gasolina?: number;
  km?: number;
  outros?: number;
  precoGasolina?: number;
  tipoCombustivel?: string;
  legacyFields?: Record<string, unknown>;
  updatedAt?: unknown;
};

export type FirestoreMonthlyDocument = {
  month?: string;
  luz?: number;
  legacyFields?: Record<string, unknown>;
  updatedAt?: unknown;
};

export type FirestoreDailyMonthlySnapshot = {
  gastosDiarios: DailyExpenses;
  gastosMensais: MonthlyExpenses;
};

export type FirestoreCostChange = {
  period: CostPeriod;
  key: string;
  field?: CostField;
  deleted?: boolean;
};

export type FirestoreMutationOptions = {
  beforeWrite?: Promise<boolean>;
  canRun?: () => boolean;
  changes?: readonly FirestoreCostChange[];
  changedFields?: readonly CostField[];
};

export type FirestoreReadOptions = {
  canRun?: () => boolean;
};

function numberOrUndefined(value: unknown): number | undefined {
  const normalized = normalizeMoney(value);
  return normalized === undefined ? undefined : normalized;
}

function toInput(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function normalizeDate(value: string): string {
  const normalized = normalizeLegacyDate(value);
  if (!normalized) throw new Error('Informe uma data vÃ¡lida.');
  return normalized;
}

function normalizeMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Informe um mÃªs vÃ¡lido.');
  return value;
}

export function dailyDocumentToExpense(id: string, value: FirestoreDailyDocument): DailyExpense {
  const date = normalizeLegacyDate(value.data) ?? id;
  return {
    data: date,
    estar: numberOrUndefined(value.estar),
    gasolina: numberOrUndefined(value.gasolina),
    km: numberOrUndefined(value.km),
    outros: numberOrUndefined(value.outros),
    precoGasolina: numberOrUndefined(value.precoGasolina),
    tipoCombustivel: value.tipoCombustivel,
    legacyFields: value.legacyFields,
  };
}

export function monthlyDocumentToExpense(value: FirestoreMonthlyDocument): MonthlyExpense {
  return {
    luz: numberOrUndefined(value.luz),
    legacyFields: value.legacyFields,
  };
}

export function costValuesToDailyDocument(
  dateValue: string,
  values: CostValues,
): FirestoreDailyDocument {
  const data = normalizeDate(dateValue);
  return {
    data,
    ...(numberOrUndefined(values.estar) === undefined
      ? {}
      : { estar: numberOrUndefined(values.estar) }),
    ...(numberOrUndefined(values.fuel) === undefined
      ? {}
      : { gasolina: numberOrUndefined(values.fuel) }),
    ...(numberOrUndefined(values.kilometers) === undefined
      ? {}
      : { km: numberOrUndefined(values.kilometers) }),
    ...(numberOrUndefined(values.other) === undefined
      ? {}
      : { outros: numberOrUndefined(values.other) }),
    ...(numberOrUndefined(values.fuelPrice) === undefined
      ? {}
      : { precoGasolina: numberOrUndefined(values.fuelPrice) }),
    ...(values.fuelType ? { tipoCombustivel: values.fuelType } : {}),
  };
}

const DAILY_WRITABLE_FIELDS = [
  'estar',
  'gasolina',
  'km',
  'outros',
  'precoGasolina',
  'tipoCombustivel',
] as const;

export function costValuesToDailyWriteDocument(
  dateValue: string,
  values: CostValues,
  _deleteFieldValue: () => unknown,
): Record<string, unknown> {
  return costValuesToDailyDocument(dateValue, values) as Record<string, unknown>;
}

export function costValuesToDailyPatchDocument(
  dateValue: string,
  values: CostValues,
  fields: readonly CostField[],
  deleteFieldValue: () => unknown,
): Record<string, unknown> {
  const document = costValuesToDailyDocument(dateValue, values) as Record<string, unknown>;
  const writableFields = fields
    .map((field) => firestoreDailyField(field))
    .filter(
      (field): field is (typeof DAILY_WRITABLE_FIELDS)[number] =>
        field !== undefined && DAILY_WRITABLE_FIELDS.includes(field),
    );

  return {
    data: document.data,
    ...Object.fromEntries(
      writableFields.map((field) => [
        field,
        field in document ? document[field] : deleteFieldValue(),
      ]),
    ),
  };
}

function firestoreDailyField(field: CostField): (typeof DAILY_WRITABLE_FIELDS)[number] | undefined {
  switch (field) {
    case 'estar':
      return 'estar';
    case 'fuel':
      return 'gasolina';
    case 'kilometers':
      return 'km';
    case 'other':
      return 'outros';
    case 'fuelPrice':
      return 'precoGasolina';
    case 'fuelType':
      return 'tipoCombustivel';
    default:
      return undefined;
  }
}

export function costValuesToMonthlyDocument(
  _month: string,
  values: CostValues,
): FirestoreMonthlyDocument {
  return {
    month: _month,
    ...(numberOrUndefined(values.light) === undefined
      ? {}
      : { luz: numberOrUndefined(values.light) }),
  };
}

export function costValuesToMonthlyPatchDocument(
  month: string,
  values: CostValues,
  fields: readonly CostField[],
  deleteFieldValue: () => unknown,
): Record<string, unknown> {
  return {
    month,
    ...(fields.includes('light')
      ? {
          luz: numberOrUndefined(values.light) ?? deleteFieldValue(),
        }
      : {}),
  };
}

export function dailyExpenseToCostValues(expense?: DailyExpense): CostValues {
  return {
    estar: toInput(expense?.estar),
    fuel: toInput(expense?.gasolina),
    fuelPrice: toInput(expense?.precoGasolina),
    fuelType: expense?.tipoCombustivel ?? '',
    kilometers: toInput(expense?.km),
    light: '',
    other: toInput(expense?.outros),
  };
}

export function monthlyExpenseToCostValues(expense?: MonthlyExpense): CostValues {
  return {
    estar: '',
    fuel: '',
    fuelPrice: '',
    fuelType: '',
    kilometers: '',
    light: toInput(typeof expense === 'number' ? expense : expense?.luz),
    other: '',
  };
}

export function snapshotToCostSettings(snapshot: FirestoreDailyMonthlySnapshot): CostSettings {
  return {
    periods: {
      day: Object.fromEntries(
        Object.entries(snapshot.gastosDiarios).map(([date, expense]) => [
          date,
          dailyExpenseToCostValues(expense),
        ]),
      ),
      month: Object.fromEntries(
        Object.entries(snapshot.gastosMensais).map(([month, expense]) => [
          month,
          monthlyExpenseToCostValues(expense),
        ]),
      ),
      year: {},
    },
  };
}

function firestoreModule(): typeof import('firebase/firestore') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('firebase/firestore') as typeof import('firebase/firestore');
}

function firebaseFirestoreModule(): typeof import('@/services/firebase/firestore') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase/firestore') as typeof import('@/services/firebase/firestore');
}

function dailyCollectionFor(uid: string) {
  return firestoreModule().collection(
    firebaseFirestoreModule().getFirebaseFirestore(),
    'users',
    uid,
    'dailyData',
  );
}

function monthlyCollectionFor(uid: string) {
  return firestoreModule().collection(
    firebaseFirestoreModule().getFirebaseFirestore(),
    'users',
    uid,
    'monthlyData',
  );
}

export class FirestoreDailyMonthlyDataSource {
  private readonly daily = new Map<string, Map<string, DailyExpense>>();
  private readonly monthly = new Map<string, Map<string, MonthlyExpense>>();
  private readonly mutationQueues = new Map<string, Promise<void>>();

  public async load(
    uid: string,
    query: DailyMonthlyQuery,
    options?: FirestoreReadOptions,
  ): Promise<FirestoreDailyMonthlySnapshot> {
    const canRun = () => !options?.canRun || options.canRun();
    if (!canRun()) return emptySnapshot();

    const { doc, getDoc, getDocs, query: buildQuery, where } = firestoreModule();
    if (!canRun()) return emptySnapshot();
    const dailyCollection = dailyCollectionFor(uid);
    const monthlyCollection = monthlyCollectionFor(uid);
    if (!canRun()) return emptySnapshot();
    const dailyForUser = query.loadAll ? new Map<string, DailyExpense>() : this.dailyFor(uid);
    const monthlyForUser = query.loadAll ? new Map<string, MonthlyExpense>() : this.monthlyFor(uid);
    const dailyRange = normalizedDailyRange(query);
    const dailyDocuments = query.loadAll
      ? (await getDocs(dailyCollection)).docs
      : query.date
        ? [await getDoc(doc(dailyCollection, normalizeDate(query.date)))]
        : query.month
          ? (
              await getDocs(
                buildQuery(
                  dailyCollection,
                  where('data', '>=', `${normalizeMonth(query.month)}-01`),
                  where('data', '<=', `${normalizeMonth(query.month)}-31`),
                ),
              )
            ).docs
          : (
              await getDocs(
                buildQuery(
                  dailyCollection,
                  ...(dailyRange[0] ? [where('data', '>=', dailyRange[0])] : []),
                  ...(dailyRange[1] ? [where('data', '<=', dailyRange[1])] : []),
                ),
              )
            ).docs;

    if (!canRun()) return emptySnapshot();
    dailyDocuments.forEach((item) => {
      if (!item.exists()) return;
      const mapped = dailyDocumentToExpense(item.id, item.data() as FirestoreDailyDocument);
      dailyForUser.set(mapped.data, mapped);
    });

    const months = requestedMonths(query);
    const monthlyDocuments = query.loadAll
      ? (await getDocs(monthlyCollection)).docs
      : months.length === 1
        ? [await getDoc(doc(monthlyCollection, months[0]))]
        : (
            await getDocs(
              buildQuery(
                monthlyCollection,
                ...(months.length > 0 ? [where('month', '>=', months[0])] : []),
                ...(months.length > 0 ? [where('month', '<=', months[months.length - 1])] : []),
              ),
            )
          ).docs;

    if (!canRun()) return emptySnapshot();
    monthlyDocuments.forEach((item) => {
      if (!item.exists()) return;
      monthlyForUser.set(
        item.id,
        monthlyDocumentToExpense(item.data() as FirestoreMonthlyDocument),
      );
    });

    if (query.loadAll) {
      this.daily.set(uid, dailyForUser);
      this.monthly.set(uid, monthlyForUser);
    }

    return {
      gastosDiarios: selectDaily(dailyForUser, query),
      gastosMensais: selectMonthly(monthlyForUser, query),
    };
  }

  public saveDaily(
    uid: string,
    date: string,
    values: CostValues,
    options?: FirestoreMutationOptions,
  ): Promise<DailyExpense> {
    const normalizedDate = normalizeDate(date);
    return this.enqueueMutation(
      uid,
      `day:${normalizedDate}`,
      () => this.writeDaily(uid, normalizedDate, values, options?.canRun, options?.changedFields),
      options,
    );
  }

  private async writeDaily(
    uid: string,
    normalizedDate: string,
    values: CostValues,
    canRun?: () => boolean,
    changedFields?: readonly CostField[],
  ) {
    const { deleteField, doc, serverTimestamp, setDoc } = firestoreModule();
    const writeDocument = changedFields
      ? costValuesToDailyPatchDocument(normalizedDate, values, changedFields, deleteField)
      : costValuesToDailyWriteDocument(normalizedDate, values, deleteField);
    await setDoc(
      doc(dailyCollectionFor(uid), normalizedDate),
      {
        ...writeDocument,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    const expense = mergeDailyExpense(
      this.dailyFor(uid).get(normalizedDate),
      dailyDocumentToExpense(normalizedDate, costValuesToDailyDocument(normalizedDate, values)),
      changedFields,
    );
    if (canRun && !canRun()) return expense;
    this.dailyFor(uid).set(normalizedDate, expense);
    if (!canRun || canRun()) {
      void financialPeriodSnapshotCache.invalidate(uid, normalizedDate.slice(0, 7));
    }
    return expense;
  }

  public saveMonthly(
    uid: string,
    month: string,
    values: CostValues,
    options?: FirestoreMutationOptions,
  ): Promise<MonthlyExpense> {
    const normalizedMonth = normalizeMonth(month);
    return this.enqueueMutation(
      uid,
      `month:${normalizedMonth}`,
      () =>
        this.writeMonthly(uid, normalizedMonth, values, options?.canRun, options?.changedFields),
      options,
    );
  }

  private async writeMonthly(
    uid: string,
    normalizedMonth: string,
    values: CostValues,
    canRun?: () => boolean,
    changedFields?: readonly CostField[],
  ) {
    const { deleteField, doc, serverTimestamp, setDoc } = firestoreModule();
    const writeDocument = changedFields
      ? costValuesToMonthlyPatchDocument(normalizedMonth, values, changedFields, deleteField)
      : costValuesToMonthlyDocument(normalizedMonth, values);
    await setDoc(
      doc(monthlyCollectionFor(uid), normalizedMonth),
      { ...writeDocument, updatedAt: serverTimestamp() },
      { merge: true },
    );
    const previous = this.monthlyFor(uid).get(normalizedMonth);
    const mapped = monthlyDocumentToExpense(costValuesToMonthlyDocument(normalizedMonth, values));
    const expense = mergeMonthlyExpense(previous, mapped, changedFields);
    if (canRun && !canRun()) return expense;
    this.monthlyFor(uid).set(normalizedMonth, expense);
    if (!canRun || canRun()) void financialPeriodSnapshotCache.invalidate(uid, normalizedMonth);
    return expense;
  }

  public deleteDaily(uid: string, date: string, options?: FirestoreMutationOptions): Promise<void> {
    const normalizedDate = normalizeDate(date);
    return this.enqueueMutation(
      uid,
      `day:${normalizedDate}`,
      () => this.writeDeleteDaily(uid, normalizedDate, options?.canRun),
      options,
    );
  }

  private async writeDeleteDaily(
    uid: string,
    normalizedDate: string,
    canRun?: () => boolean,
  ): Promise<void> {
    const { deleteDoc, doc } = firestoreModule();
    await deleteDoc(doc(dailyCollectionFor(uid), normalizedDate));
    if (canRun && !canRun()) return;
    this.dailyFor(uid).delete(normalizedDate);
    if (!canRun || canRun()) {
      void financialPeriodSnapshotCache.invalidate(uid, normalizedDate.slice(0, 7));
    }
  }

  public async loadAllAsCostSettings(
    uid: string,
    options?: FirestoreReadOptions,
  ): Promise<CostSettings> {
    return snapshotToCostSettings(await this.load(uid, { loadAll: true }, options));
  }

  public async saveSettingsDiff(
    uid: string,
    previous: CostSettings,
    next: CostSettings,
    options?: FirestoreMutationOptions,
  ): Promise<void> {
    const operations: Promise<unknown>[] = [];
    const dayKeys = new Set([
      ...Object.keys(previous.periods.day),
      ...Object.keys(next.periods.day),
    ]);
    for (const date of dayKeys) {
      const before = previous.periods.day[date];
      const after = next.periods.day[date];
      if (before && !after) {
        operations.push(this.deleteDaily(uid, date, options));
      } else if (JSON.stringify(before) !== JSON.stringify(after) && after) {
        operations.push(
          this.saveDaily(
            uid,
            date,
            after,
            before ? mutationOptionsFor(options, 'day', date, before, after) : options,
          ),
        );
      }
    }

    const monthKeys = new Set([
      ...Object.keys(previous.periods.month),
      ...Object.keys(next.periods.month),
    ]);
    for (const month of monthKeys) {
      const before = previous.periods.month[month];
      const after = next.periods.month[month];
      if (JSON.stringify(before) !== JSON.stringify(after) && after) {
        operations.push(
          this.saveMonthly(
            uid,
            month,
            after,
            before ? mutationOptionsFor(options, 'month', month, before, after) : options,
          ),
        );
      }
    }

    await Promise.all(operations);
  }

  private dailyFor(uid: string): Map<string, DailyExpense> {
    const existing = this.daily.get(uid);
    if (existing) return existing;
    const created = new Map<string, DailyExpense>();
    this.daily.set(uid, created);
    return created;
  }

  private monthlyFor(uid: string): Map<string, MonthlyExpense> {
    const existing = this.monthly.get(uid);
    if (existing) return existing;
    const created = new Map<string, MonthlyExpense>();
    this.monthly.set(uid, created);
    return created;
  }

  private enqueueMutation<T>(
    uid: string,
    recordKey: string,
    operation: () => Promise<T>,
    options?: FirestoreMutationOptions,
  ): Promise<T> {
    const queueKey = `${uid}:${recordKey}`;
    const previous = this.mutationQueues.get(queueKey) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        if (options?.canRun && !options.canRun()) return undefined as T;
        if (options?.beforeWrite && !(await options.beforeWrite)) return undefined as T;
        if (options?.canRun && !options.canRun()) return undefined as T;
        return operation();
      });
    const recovered: Promise<void> = current.then(
      () => undefined,
      (error) => {
        if (__DEV__) console.warn('[FirestoreDailyMonthlyDataSource] Falha na mutação.', error);
      },
    );
    this.mutationQueues.set(queueKey, recovered);
    void recovered.finally(() => {
      if (this.mutationQueues.get(queueKey) === recovered) this.mutationQueues.delete(queueKey);
    });
    return current;
  }
}

function mutationOptionsFor(
  options: FirestoreMutationOptions | undefined,
  period: CostPeriod,
  key: string,
  before: CostValues,
  after: CostValues,
): FirestoreMutationOptions {
  if (options?.changes) {
    const changedFields = options.changes
      .filter((change) => change.period === period && change.key === key && change.field)
      .map((change) => change.field as CostField);
    return { ...options, changedFields };
  }

  return { ...(options ?? {}), changedFields: changedCostFields(before, after) };
}

function changedCostFields(before: CostValues, after: CostValues): CostField[] {
  return (
    ['light', 'estar', 'kilometers', 'fuel', 'fuelPrice', 'fuelType', 'other'] as const
  ).filter((field) => before[field] !== after[field]);
}

function mergeDailyExpense(
  previous: DailyExpense | undefined,
  mapped: DailyExpense,
  changedFields?: readonly CostField[],
): DailyExpense {
  if (!changedFields) {
    const expense = { ...(previous ?? {}), ...mapped, data: mapped.data };
    if (mapped.legacyFields === undefined && previous?.legacyFields !== undefined) {
      expense.legacyFields = previous.legacyFields;
    }
    return expense;
  }

  const expense: DailyExpense = { ...(previous ?? {}), data: mapped.data };
  for (const field of changedFields) {
    switch (field) {
      case 'estar':
        expense.estar = mapped.estar;
        break;
      case 'fuel':
        expense.gasolina = mapped.gasolina;
        break;
      case 'kilometers':
        expense.km = mapped.km;
        break;
      case 'other':
        expense.outros = mapped.outros;
        break;
      case 'fuelPrice':
        expense.precoGasolina = mapped.precoGasolina;
        break;
      case 'fuelType':
        expense.tipoCombustivel = mapped.tipoCombustivel;
        break;
      default:
        break;
    }
  }
  return expense;
}

function mergeMonthlyExpense(
  previous: MonthlyExpense | undefined,
  mapped: MonthlyExpense,
  changedFields?: readonly CostField[],
): MonthlyExpense {
  const previousRecord =
    typeof previous === 'number'
      ? { luz: previous }
      : previous && typeof previous === 'object'
        ? previous
        : {};
  const mappedRecord = typeof mapped === 'object' ? mapped : { luz: mapped };
  if (!changedFields) {
    const expense = { ...previousRecord, ...mappedRecord };
    if (mappedRecord.legacyFields === undefined && previousRecord.legacyFields !== undefined) {
      expense.legacyFields = previousRecord.legacyFields;
    }
    return expense;
  }

  const expense = { ...previousRecord };
  if (changedFields.includes('light')) expense.luz = mappedRecord.luz;
  return expense;
}

function requestedMonths(query: DailyMonthlyQuery): string[] {
  if (query.month) return [normalizeMonth(query.month)];
  if (query.date) return [normalizeDate(query.date).slice(0, 7)];
  if (query.startDate && query.endDate) {
    const start = normalizeDate(query.startDate).slice(0, 7);
    const end = normalizeDate(query.endDate).slice(0, 7);
    const months: string[] = [];
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    const current = new Date(startYear, startMonth - 1, 1, 12);
    const last = new Date(endYear, endMonth - 1, 1, 12);
    while (current <= last) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }
  return [];
}

function emptySnapshot(): FirestoreDailyMonthlySnapshot {
  return { gastosDiarios: {}, gastosMensais: {} };
}

function normalizedDailyRange(query: DailyMonthlyQuery): [string | undefined, string | undefined] {
  if (query.startDate || query.endDate) {
    return [
      query.startDate ? normalizeDate(query.startDate) : undefined,
      query.endDate ? normalizeDate(query.endDate) : undefined,
    ];
  }
  return [undefined, undefined];
}

function selectDaily(values: Map<string, DailyExpense>, query: DailyMonthlyQuery): DailyExpenses {
  return Object.fromEntries(
    [...values.entries()].filter(([date]) => {
      if (query.loadAll) return true;
      if (query.date) return date === normalizeDate(query.date);
      if (query.month) return date.startsWith(normalizeMonth(query.month));
      return (
        (!query.startDate || date >= normalizeDate(query.startDate)) &&
        (!query.endDate || date <= normalizeDate(query.endDate))
      );
    }),
  );
}

function selectMonthly(
  values: Map<string, MonthlyExpense>,
  query: DailyMonthlyQuery,
): MonthlyExpenses {
  const months = requestedMonths(query);
  return Object.fromEntries(
    [...values.entries()].filter(([month]) => query.loadAll || months.includes(month)),
  );
}

export const firestoreDailyMonthlyDataSource = new FirestoreDailyMonthlyDataSource();
