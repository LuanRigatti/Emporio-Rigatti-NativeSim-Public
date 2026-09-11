import type { DailyExpense, DailyExpenses, MonthlyExpense, MonthlyExpenses } from '@/types/data';
import { normalizeLegacyDate, normalizeMoney } from '@/utils/data';
import { financialPeriodSnapshotCache } from '@/services/finance/FinancialPeriodSnapshotCache';

import type { CostSettings, CostValues } from './CostSettingsStorage';

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
  deleteFieldValue: () => unknown,
): Record<string, unknown> {
  const document = costValuesToDailyDocument(dateValue, values) as Record<string, unknown>;
  return {
    data: document.data,
    ...Object.fromEntries(
      DAILY_WRITABLE_FIELDS.map((field) => [
        field,
        field in document ? document[field] : deleteFieldValue(),
      ]),
    ),
  };
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

async function dailyCollectionFor(uid: string) {
  const { collection } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'dailyData');
}

async function monthlyCollectionFor(uid: string) {
  const { collection } = await import('firebase/firestore');
  const { getFirebaseFirestore } = await import('@/services/firebase/firestore');
  return collection(getFirebaseFirestore(), 'users', uid, 'monthlyData');
}

export class FirestoreDailyMonthlyDataSource {
  private readonly daily = new Map<string, DailyExpense>();
  private readonly monthly = new Map<string, MonthlyExpense>();

  public async load(uid: string, query: DailyMonthlyQuery): Promise<FirestoreDailyMonthlySnapshot> {
    const { doc, getDoc, getDocs, query: buildQuery, where } = await import('firebase/firestore');
    const dailyCollection = await dailyCollectionFor(uid);
    const monthlyCollection = await monthlyCollectionFor(uid);
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

    dailyDocuments.forEach((item) => {
      if (!item.exists()) return;
      const mapped = dailyDocumentToExpense(item.id, item.data() as FirestoreDailyDocument);
      this.daily.set(mapped.data, mapped);
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

    monthlyDocuments.forEach((item) => {
      if (!item.exists()) return;
      this.monthly.set(item.id, monthlyDocumentToExpense(item.data() as FirestoreMonthlyDocument));
    });

    return {
      gastosDiarios: selectDaily(this.daily, query),
      gastosMensais: selectMonthly(this.monthly, query),
    };
  }

  public async saveDaily(uid: string, date: string, values: CostValues): Promise<DailyExpense> {
    const normalizedDate = normalizeDate(date);
    const { deleteField, doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(await dailyCollectionFor(uid), normalizedDate),
      {
        ...costValuesToDailyWriteDocument(normalizedDate, values, deleteField),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    const expense = {
      ...this.daily.get(normalizedDate),
      ...dailyDocumentToExpense(normalizedDate, costValuesToDailyDocument(normalizedDate, values)),
      data: normalizedDate,
    };
    this.daily.set(normalizedDate, expense);
    void financialPeriodSnapshotCache.invalidate(uid, normalizedDate.slice(0, 7));
    return expense;
  }

  public async saveMonthly(
    uid: string,
    month: string,
    values: CostValues,
  ): Promise<MonthlyExpense> {
    const normalizedMonth = normalizeMonth(month);
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(
      doc(await monthlyCollectionFor(uid), normalizedMonth),
      { ...costValuesToMonthlyDocument(normalizedMonth, values), updatedAt: serverTimestamp() },
      { merge: true },
    );
    const previous = this.monthly.get(normalizedMonth);
    const mapped = monthlyDocumentToExpense(costValuesToMonthlyDocument(normalizedMonth, values));
    const expense = {
      ...(typeof previous === 'object' && previous ? previous : {}),
      ...(typeof mapped === 'object' && mapped ? mapped : { luz: mapped }),
    };
    this.monthly.set(normalizedMonth, expense);
    void financialPeriodSnapshotCache.invalidate(uid, normalizedMonth);
    return expense;
  }

  public async deleteDaily(uid: string, date: string): Promise<void> {
    const normalizedDate = normalizeDate(date);
    const { deleteDoc, doc } = await import('firebase/firestore');
    await deleteDoc(doc(await dailyCollectionFor(uid), normalizedDate));
    this.daily.delete(normalizedDate);
    void financialPeriodSnapshotCache.invalidate(uid, normalizedDate.slice(0, 7));
  }

  public async loadAllAsCostSettings(uid: string): Promise<CostSettings> {
    return snapshotToCostSettings(await this.load(uid, { loadAll: true }));
  }

  public async saveSettingsDiff(
    uid: string,
    previous: CostSettings,
    next: CostSettings,
  ): Promise<void> {
    const dayKeys = new Set([
      ...Object.keys(previous.periods.day),
      ...Object.keys(next.periods.day),
    ]);
    for (const date of dayKeys) {
      const before = previous.periods.day[date];
      const after = next.periods.day[date];
      if (before && !after) {
        await this.deleteDaily(uid, date);
      } else if (JSON.stringify(before) !== JSON.stringify(after) && after) {
        await this.saveDaily(uid, date, after);
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
        await this.saveMonthly(uid, month, after);
      }
    }
  }
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
