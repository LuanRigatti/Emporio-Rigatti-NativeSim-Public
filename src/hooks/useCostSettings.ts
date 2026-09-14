import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ENABLE_FIRESTORE_DAILY_MONTHLY } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import {
  addDailyValue,
  COST_SETTINGS_DEFAULT_SCOPE,
  costSettingsStorage,
  EMPTY_COST_SETTINGS,
  EMPTY_COST_VALUES,
  firestoreDailyMonthlyDataSource,
  localDailyDataDataSource,
  setDailyValue,
  type CostField,
  type CostPeriod,
  type CostSettings,
  type CostValues,
  type FirestoreCostChange,
} from '@/services/costs';

type SettingsUpdater = (current: CostSettings) => CostSettings;
type DirtyChange = {
  revision: number;
  period: CostPeriod;
  key: string;
  field?: CostField;
  deleted?: boolean;
};
type DirtyChangeInput = Omit<DirtyChange, 'revision'>;
type RemoteStatus = 'disabled' | 'loading' | 'ready' | 'failed';
type PendingLocalSave = {
  settings: CostSettings;
  promise: Promise<boolean>;
};

export function useCostSettings() {
  const { user, sessionVersion } = useAuth();
  const userId = user?.id ?? null;
  const storageScope = userId ?? COST_SETTINGS_DEFAULT_SCOPE;
  const sessionKey = createSessionKey(userId, sessionVersion);
  const sessionKeyRef = useRef(sessionKey);
  useLayoutEffect(() => {
    sessionKeyRef.current = sessionKey;
  }, [sessionKey]);

  const cachedSettings = costSettingsStorage.getCached(storageScope);
  const [settings, setSettings] = useState<CostSettings>(
    () => cachedSettings ?? cloneSettings(EMPTY_COST_SETTINGS),
  );
  const [hydratedSessionKey, setHydratedSessionKey] = useState<string | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>(() =>
    userId && ENABLE_FIRESTORE_DAILY_MONTHLY ? 'loading' : 'disabled',
  );
  const lastHydratedSessionKey = useRef<string | null>(null);
  const localRevision = useRef(0);
  const dirtyChanges = useRef(new Map<string, DirtyChange>());
  const remoteSettings = useRef<CostSettings | null>(null);
  const mountedRef = useRef(true);
  const pendingLocalSave = useRef<PendingLocalSave | null>(null);
  const isHydrated = hydratedSessionKey === sessionKey;

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const markLocalChange = useCallback((change: DirtyChangeInput): number => {
    const revision = localRevision.current + 1;
    localRevision.current = revision;
    dirtyChanges.current.set(dirtyChangeKey(change), { ...change, revision });
    return revision;
  }, []);

  const commitLocalSettings = useCallback(
    (updater: SettingsUpdater, change: DirtyChangeInput) => {
      if (!isHydrated || !isCurrentSession(sessionKeyRef, sessionKey)) return;
      markLocalChange(change);
      setSettings((current) => updater(current));
    },
    [isHydrated, markLocalChange, sessionKey],
  );

  useEffect(() => {
    let mounted = true;
    const hydrationSessionKey = sessionKey;
    const hydrationUserId = userId;
    const sessionChanged = lastHydratedSessionKey.current !== hydrationSessionKey;
    lastHydratedSessionKey.current = hydrationSessionKey;

    if (sessionChanged) {
      localRevision.current = 0;
      dirtyChanges.current.clear();
      remoteSettings.current = null;
      pendingLocalSave.current = null;
      setSettings(cloneSettings(EMPTY_COST_SETTINGS));
      setHydratedSessionKey(null);
      setRemoteStatus(hydrationUserId && ENABLE_FIRESTORE_DAILY_MONTHLY ? 'loading' : 'disabled');
    }

    const hydrationRevision = localRevision.current;
    void (async () => {
      let storedSettings: CostSettings;
      try {
        storedSettings = await localDailyDataDataSource.load(storageScope, {
          canRun: () => mounted && isCurrentSession(sessionKeyRef, hydrationSessionKey),
          sessionKey: hydrationSessionKey,
        });
      } catch (error) {
        if (!mounted || !isCurrentSession(sessionKeyRef, hydrationSessionKey)) return;
        if (__DEV__) console.warn('[useCostSettings] Local cost settings fallback empty.', error);
        storedSettings = cloneSettings(EMPTY_COST_SETTINGS);
      }
      if (!mounted || !isCurrentSession(sessionKeyRef, hydrationSessionKey)) return;

      if (localRevision.current === hydrationRevision) {
        setSettings((current) =>
          settingsEquivalent(current, storedSettings) ? current : storedSettings,
        );
      }
      setHydratedSessionKey(hydrationSessionKey);

      if (!hydrationUserId || !ENABLE_FIRESTORE_DAILY_MONTHLY) return;

      try {
        const remote = await firestoreDailyMonthlyDataSource.loadAllAsCostSettings(
          hydrationUserId,
          { canRun: () => mounted && isCurrentSession(sessionKeyRef, hydrationSessionKey) },
        );
        if (!mounted || !isCurrentSession(sessionKeyRef, hydrationSessionKey)) return;

        const hasLocalEdits = localRevision.current !== hydrationRevision;
        remoteSettings.current = cloneSettings(remote);

        if (hasLocalEdits) {
          const localChanges = [...dirtyChanges.current.values()].filter(
            ({ revision }) => revision > hydrationRevision,
          );
          setSettings((current) => {
            const merged = mergeRemoteWithLocalChanges(
              remote,
              storedSettings,
              current,
              localChanges,
            );
            return settingsEquivalent(current, merged) ? current : merged;
          });
        } else {
          setSettings((current) => {
            const merged = mergeRemoteWithLocalChanges(remote, storedSettings, current, []);
            return settingsEquivalent(current, merged) ? current : merged;
          });
        }
        setRemoteStatus('ready');
      } catch (error) {
        if (!mounted || !isCurrentSession(sessionKeyRef, hydrationSessionKey)) return;
        if (__DEV__) console.warn('[useCostSettings] Firestore fallback local.', error);
        setRemoteStatus('failed');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sessionKey, storageScope, userId]);

  useEffect(() => {
    let active = true;
    if (!isHydrated) {
      return () => {
        active = false;
      };
    }

    const canRun = () => active && isCurrentSession(sessionKeyRef, sessionKey);
    const pendingSave = pendingLocalSave.current;
    const localSave =
      pendingSave?.settings === settings
        ? pendingSave.promise
        : localDailyDataDataSource.save(settings, storageScope, { canRun, sessionKey }).then(
            () => true,
            (error) => {
              if (__DEV__)
                console.warn('[useCostSettings] Local cost settings save failed.', error);
              return false;
            },
          );
    if (pendingSave?.settings === settings) pendingLocalSave.current = null;

    if (!userId || remoteStatus !== 'ready' || !remoteSettings.current) {
      return () => {
        active = false;
      };
    }

    const syncRevision = localRevision.current;
    const previous = cloneSettings(remoteSettings.current);
    const next = cloneSettings(settings);
    const syncChanges: FirestoreCostChange[] = [...dirtyChanges.current.values()]
      .filter(({ revision }) => revision <= syncRevision)
      .map(({ period, key, field, deleted }) => ({ period, key, field, deleted }));

    void firestoreDailyMonthlyDataSource
      .saveSettingsDiff(userId, previous, next, {
        beforeWrite: localSave,
        canRun,
        changes: syncChanges,
      })
      .then(async () => {
        if (!(await localSave) || !canRun() || localRevision.current !== syncRevision) return;

        remoteSettings.current = next;
        for (const [key, change] of dirtyChanges.current) {
          if (change.revision <= syncRevision) dirtyChanges.current.delete(key);
        }
      })
      .catch((error) => {
        if (__DEV__) console.warn('[useCostSettings] Firestore save pending.', error);
      });

    return () => {
      active = false;
    };
  }, [isHydrated, remoteStatus, sessionKey, settings, storageScope, userId]);

  const sessionSettings = isHydrated ? settings : EMPTY_COST_SETTINGS;

  const getValues = useCallback(
    (period: CostPeriod, key: string): CostValues =>
      sessionSettings.periods[period][key] ?? { ...EMPTY_COST_VALUES },
    [sessionSettings],
  );

  const getLatestDailyValue = useCallback(
    (field: CostField): string => {
      const entries = Object.entries(sessionSettings.periods.day).sort(([left], [right]) =>
        right.localeCompare(left),
      );
      for (const [, values] of entries) {
        const value = values[field];
        if (value.trim()) return value;
      }
      return '';
    },
    [sessionSettings],
  );

  const getMonthlySum = useCallback(
    (year: number, month: number, field: CostField) => {
      const prefix = `${year}-${String(month).padStart(2, '0')}-`;
      return Object.entries(sessionSettings.periods.day).reduce((total, [key, values]) => {
        if (!key.startsWith(prefix)) return total;
        return total + parseCostNumber(values[field]);
      }, 0);
    },
    [sessionSettings],
  );

  const updateField = useCallback(
    (period: CostPeriod, key: string, field: CostField, value: string) => {
      commitLocalSettings(
        (current) => ({
          periods: {
            ...current.periods,
            [period]: {
              ...current.periods[period],
              [key]: {
                ...(current.periods[period][key] ?? EMPTY_COST_VALUES),
                [field]: value,
              },
            },
          },
        }),
        { period, key, field },
      );
    },
    [commitLocalSettings],
  );

  const addFieldValue = useCallback(
    (period: CostPeriod, key: string, field: CostField, value: string) => {
      commitLocalSettings(
        (current) => ({
          periods: {
            ...current.periods,
            [period]: {
              ...current.periods[period],
              [key]: {
                ...(current.periods[period][key] ?? EMPTY_COST_VALUES),
                [field]: addDailyValue(current.periods[period][key]?.[field] ?? '', value),
              },
            },
          },
        }),
        { period, key, field },
      );
    },
    [commitLocalSettings],
  );

  const setFieldValue = useCallback(
    (period: CostPeriod, key: string, field: CostField, value: string) => {
      commitLocalSettings(
        (current) => ({
          periods: {
            ...current.periods,
            [period]: {
              ...current.periods[period],
              [key]: {
                ...(current.periods[period][key] ?? EMPTY_COST_VALUES),
                [field]: setDailyValue(current.periods[period][key]?.[field] ?? '', value),
              },
            },
          },
        }),
        { period, key, field },
      );
    },
    [commitLocalSettings],
  );

  const deleteDailyData = useCallback(
    async (date: string): Promise<boolean> => {
      if (
        !isHydrated ||
        !isCurrentSession(sessionKeyRef, sessionKey) ||
        !sessionSettings.periods.day[date]
      ) {
        return true;
      }

      const nextSettings: CostSettings = {
        periods: {
          ...sessionSettings.periods,
          day: Object.fromEntries(
            Object.entries(sessionSettings.periods.day).filter(
              ([currentDate]) => currentDate !== date,
            ),
          ),
        },
      };
      const deleteSessionKey = sessionKey;
      const localSave = localDailyDataDataSource
        .save(nextSettings, storageScope, {
          canRun: () => mountedRef.current && isCurrentSession(sessionKeyRef, deleteSessionKey),
          sessionKey: deleteSessionKey,
        })
        .then(
          () => true,
          (error) => {
            if (__DEV__)
              console.warn('[useCostSettings] Local cost settings delete failed.', error);
            return false;
          },
        );
      markLocalChange({ period: 'day', key: date, deleted: true });
      pendingLocalSave.current = { settings: nextSettings, promise: localSave };
      setSettings(nextSettings);
      return localSave;
    },
    [isHydrated, markLocalChange, sessionKey, sessionSettings, storageScope],
  );

  return {
    addFieldValue,
    deleteDailyData,
    getMonthlySum,
    getLatestDailyValue,
    getValues,
    isHydrated,
    setFieldValue,
    updateField,
  };
}

function mergeRemoteWithLocalChanges(
  remote: CostSettings,
  stored: CostSettings,
  current: CostSettings,
  changes: DirtyChange[],
): CostSettings {
  const merged = cloneSettings(remote);
  preserveLocalOnlyRecords(merged, stored);
  const orderedChanges = [...changes].sort((left, right) => left.revision - right.revision);

  for (const change of orderedChanges) {
    const period = merged.periods[change.period];
    if (change.deleted) {
      delete period[change.key];
      continue;
    }
    if (!change.field) continue;

    const localValues = current.periods[change.period][change.key];
    if (!localValues) continue;
    period[change.key] = {
      ...(period[change.key] ?? localValues),
      [change.field]: localValues[change.field],
    };
  }

  return merged;
}

function preserveLocalOnlyRecords(target: CostSettings, stored: CostSettings): void {
  for (const period of ['day', 'month', 'year'] as CostPeriod[]) {
    for (const [key, values] of Object.entries(stored.periods[period])) {
      if (!target.periods[period][key]) target.periods[period][key] = { ...values };
    }
  }
}

function cloneSettings(settings: CostSettings): CostSettings {
  return {
    periods: {
      day: clonePeriod(settings.periods.day),
      month: clonePeriod(settings.periods.month),
      year: clonePeriod(settings.periods.year),
    },
  };
}

function clonePeriod(period: Record<string, CostValues>): Record<string, CostValues> {
  return Object.fromEntries(Object.entries(period).map(([key, values]) => [key, { ...values }]));
}

function createSessionKey(userId: string | null, sessionVersion: number): string {
  return `${userId ?? 'anonymous'}:${sessionVersion}`;
}

function isCurrentSession(sessionKeyRef: { current: string }, sessionKey: string): boolean {
  return sessionKeyRef.current === sessionKey;
}

function dirtyChangeKey(change: DirtyChangeInput): string {
  return `${change.deleted ? 'delete' : 'field'}:${change.period}:${change.key}:${change.field ?? ''}`;
}

function settingsEquivalent(left: CostSettings, right: CostSettings): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseCostNumber(value: string): number {
  const raw = value.trim().replace(/R\$\s?/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
