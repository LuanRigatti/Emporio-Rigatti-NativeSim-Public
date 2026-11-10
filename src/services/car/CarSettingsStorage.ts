import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_CAR_SETTINGS, type CarSettings } from './CarSettings';

export { EMPTY_CAR_SETTINGS, type CarSettings } from './CarSettings';

/** Legacy unscoped value. Kept untouched and intentionally never read or migrated. */
export const CAR_SETTINGS_STORAGE_KEY = '@pareact/car-settings-v1';
export const CAR_SETTINGS_STORAGE_KEY_PREFIX = '@pareact/car-settings-v2:';

export type CarSettingsStorageOptions = {
  canRun?: () => boolean;
  remoteReadRevision?: number;
  acknowledgedDraftRevisions?: Partial<Record<keyof CarSettings, number>>;
};

export type CarSettingsConfirmedSnapshot = {
  exists: boolean;
  settings: CarSettings;
};

type CarSettingsDraft = { value: string; revision: number };

export type CarSettingsDraftWrite = {
  revisions: Partial<Record<keyof CarSettings, number>>;
  persisted: Promise<void>;
};

function parseSettings(serialized: string | null): CarSettings | null {
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const value = parsed as Partial<Record<keyof CarSettings, unknown>>;
    return {
      alcoholAutonomy:
        typeof value.alcoholAutonomy === 'string'
          ? value.alcoholAutonomy
          : EMPTY_CAR_SETTINGS.alcoholAutonomy,
      gasolineAutonomy:
        typeof value.gasolineAutonomy === 'string'
          ? value.gasolineAutonomy
          : EMPTY_CAR_SETTINGS.gasolineAutonomy,
    };
  } catch {
    return null;
  }
}

export class CarSettingsStorage {
  private readonly writeQueues = new Map<string, Promise<void>>();
  private readonly localReads = new Map<string, Promise<string | null>>();
  private readonly cachedSettings = new Map<string, CarSettings>();
  private readonly confirmedSettings = new Map<string, CarSettingsConfirmedSnapshot>();
  private readonly pendingDrafts = new Map<string, Map<keyof CarSettings, CarSettingsDraft>>();
  private readonly cacheRevisions = new Map<string, number>();
  private readonly acceptedRemoteRevisions = new Map<string, number>();
  private remoteRevision = 0;
  private draftRevision = 0;

  public beginRemoteRead(): number {
    this.remoteRevision += 1;
    return this.remoteRevision;
  }

  public getCached(uid: string | null, sessionVersion: number): CarSettings | null {
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    const settings = this.cachedSettings.get(scopeKey);
    if (!settings) return null;
    return this.withDrafts(settings, this.pendingDrafts.get(scopeKey) ?? new Map());
  }

  public getConfirmed(uid: string, sessionVersion: number): CarSettingsConfirmedSnapshot | null {
    const confirmed = this.confirmedSettings.get(memoryScopeKey(uid, sessionVersion));
    return confirmed ? { exists: confirmed.exists, settings: { ...confirmed.settings } } : null;
  }

  public setCached(uid: string | null, sessionVersion: number, settings: CarSettings): void {
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    this.advanceCacheRevision(scopeKey);
    this.cachedSettings.set(scopeKey, { ...settings });
  }

  public async load(
    uid: string | null,
    sessionVersion: number,
    options?: CarSettingsStorageOptions,
  ): Promise<CarSettings> {
    if (options?.canRun && !options.canRun()) return { ...EMPTY_CAR_SETTINGS };
    const cached = this.getCached(uid, sessionVersion);
    if (cached) return cached;
    const storageKey = carSettingsStorageKey(uid);
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    const startedAtRevision = this.cacheRevisions.get(scopeKey) ?? 0;
    try {
      await this.waitForWrites(storageKey, options?.canRun);
      if (options?.canRun && !options.canRun()) return { ...EMPTY_CAR_SETTINGS };
      const serialized = await this.readLocalValue(storageKey);
      if (options?.canRun && !options.canRun()) return { ...EMPTY_CAR_SETTINGS };
      if ((this.cacheRevisions.get(scopeKey) ?? 0) !== startedAtRevision) {
        return this.cachedSettings.has(scopeKey)
          ? { ...this.cachedSettings.get(scopeKey)! }
          : { ...EMPTY_CAR_SETTINGS };
      }
      const settings = this.withDrafts(
        parseSettings(serialized) ?? { ...EMPTY_CAR_SETTINGS },
        this.pendingDrafts.get(scopeKey) ?? new Map(),
      );
      this.setCached(uid, sessionVersion, settings);
      return settings;
    } catch (error) {
      if (__DEV__) console.warn('[CarSettingsStorage] Falha ao ler dados do carro.', error);
      if (options?.canRun && !options.canRun()) return { ...EMPTY_CAR_SETTINGS };
      if ((this.cacheRevisions.get(scopeKey) ?? 0) !== startedAtRevision) {
        return this.cachedSettings.has(scopeKey)
          ? { ...this.cachedSettings.get(scopeKey)! }
          : { ...EMPTY_CAR_SETTINGS };
      }
      const settings = this.withDrafts(
        EMPTY_CAR_SETTINGS,
        this.pendingDrafts.get(scopeKey) ?? new Map(),
      );
      this.setCached(uid, sessionVersion, settings);
      return settings;
    }
  }

  public save(
    uid: string | null,
    sessionVersion: number,
    settings: CarSettings,
    options?: CarSettingsStorageOptions,
  ): Promise<void> {
    return this.persist(uid, sessionVersion, settings, options);
  }

  /** Records only explicit user edits, preserving the existing UID-scoped cache format. */
  public saveDraft(
    uid: string | null,
    sessionVersion: number,
    changes: Partial<CarSettings>,
  ): Promise<void> {
    return this.recordDraft(uid, sessionVersion, changes).persisted;
  }

  public recordDraft(
    uid: string | null,
    sessionVersion: number,
    changes: Partial<CarSettings>,
    options?: CarSettingsStorageOptions,
  ): CarSettingsDraftWrite {
    if (options?.canRun && !options.canRun()) {
      return { revisions: {}, persisted: Promise.resolve() };
    }
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    const drafts =
      this.pendingDrafts.get(scopeKey) ?? new Map<keyof CarSettings, CarSettingsDraft>();
    const revisions: Partial<Record<keyof CarSettings, number>> = {};
    for (const [field, value] of Object.entries(changes)) {
      if (
        (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
        typeof value === 'string'
      ) {
        const revision = ++this.draftRevision;
        drafts.set(field, { value, revision });
        revisions[field] = revision;
      }
    }
    this.pendingDrafts.set(scopeKey, drafts);

    const currentBase =
      this.confirmedSettings.get(scopeKey)?.settings ?? this.cachedSettings.get(scopeKey);
    if (currentBase) {
      this.setCached(uid, sessionVersion, this.withDrafts(currentBase, drafts));
    }
    const storageKey = carSettingsStorageKey(uid);
    const persisted = this.enqueueWrite(storageKey, async () => {
      if (options?.canRun && !options.canRun()) return;
      let localBase: CarSettings | undefined;
      if (!this.confirmedSettings.has(scopeKey) && !this.cachedSettings.has(scopeKey)) {
        try {
          localBase = parseSettings(await this.readLocalValue(storageKey)) ?? undefined;
          if (options?.canRun && !options.canRun()) return;
        } catch (error) {
          if (__DEV__) console.warn('[CarSettingsStorage] Falha ao ler dados do carro.', error);
        }
      }
      if (options?.canRun && !options.canRun()) return;
      const base =
        this.confirmedSettings.get(scopeKey)?.settings ??
        this.cachedSettings.get(scopeKey) ??
        localBase ??
        EMPTY_CAR_SETTINGS;
      const effective = this.withDrafts(base, drafts);
      this.setCached(uid, sessionVersion, effective);
      await AsyncStorage.setItem(carSettingsStorageKey(uid), JSON.stringify(effective));
    });
    return { revisions, persisted };
  }

  /** Applies a field-level remote ACK without inventing a complete remote snapshot. */
  public acceptPatch(
    uid: string,
    sessionVersion: number,
    changes: Partial<CarSettings>,
    options: CarSettingsStorageOptions,
  ): CarSettings | null {
    if (options.canRun && !options.canRun()) return null;
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    const remoteRevision = options.remoteReadRevision;
    if (remoteRevision !== undefined) {
      if (remoteRevision < (this.acceptedRemoteRevisions.get(scopeKey) ?? 0)) return null;
      this.acceptedRemoteRevisions.set(scopeKey, remoteRevision);
    }

    const drafts =
      this.pendingDrafts.get(scopeKey) ?? new Map<keyof CarSettings, CarSettingsDraft>();
    const base =
      this.confirmedSettings.get(scopeKey)?.settings ??
      this.cachedSettings.get(scopeKey) ??
      EMPTY_CAR_SETTINGS;
    const confirmed = { ...base };
    for (const [field, value] of Object.entries(changes)) {
      if (
        (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
        typeof value === 'string'
      ) {
        confirmed[field] = value;
        if (drafts.get(field)?.revision === options.acknowledgedDraftRevisions?.[field]) {
          drafts.delete(field);
        }
      }
    }
    if (drafts.size === 0) this.pendingDrafts.delete(scopeKey);
    else this.pendingDrafts.set(scopeKey, drafts);

    this.confirmedSettings.set(scopeKey, { exists: true, settings: confirmed });
    const effective = this.withDrafts(confirmed, drafts);
    this.setCached(uid, sessionVersion, effective);
    const storageKey = carSettingsStorageKey(uid);
    const snapshot = JSON.stringify(effective);
    void this.enqueueWrite(storageKey, async () => {
      if (options.canRun && !options.canRun()) return;
      if (
        remoteRevision !== undefined &&
        remoteRevision < (this.acceptedRemoteRevisions.get(scopeKey) ?? 0)
      ) {
        return;
      }
      await AsyncStorage.setItem(storageKey, snapshot);
    });
    return effective;
  }

  /** Removes only explicit drafts whose write was acknowledged for this session. */
  public resolveAcknowledgedDrafts(
    uid: string,
    sessionVersion: number,
    acknowledgedDraftRevisions: Partial<Record<keyof CarSettings, number>>,
    options?: CarSettingsStorageOptions,
  ): Promise<void> {
    if (options?.canRun && !options.canRun()) return Promise.resolve();
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    const drafts = this.pendingDrafts.get(scopeKey);
    if (!drafts) return Promise.resolve();

    let changed = false;
    for (const [field, revision] of Object.entries(acknowledgedDraftRevisions)) {
      if (
        (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
        drafts.get(field)?.revision === revision
      ) {
        drafts.delete(field);
        changed = true;
      }
    }
    if (!changed) return Promise.resolve();
    if (drafts.size === 0) this.pendingDrafts.delete(scopeKey);

    const base =
      this.confirmedSettings.get(scopeKey)?.settings ??
      this.cachedSettings.get(scopeKey) ??
      EMPTY_CAR_SETTINGS;
    const effective = this.withDrafts(base, drafts);
    this.setCached(uid, sessionVersion, effective);
    const storageKey = carSettingsStorageKey(uid);
    const confirmed = this.confirmedSettings.get(scopeKey);
    const snapshot =
      confirmed?.exists === false && drafts.size === 0 ? null : JSON.stringify(effective);
    return this.enqueueWrite(storageKey, async () => {
      if (options?.canRun && !options.canRun()) return;
      if (snapshot === null) await AsyncStorage.removeItem(storageKey);
      else await AsyncStorage.setItem(storageKey, snapshot);
    });
  }

  /** Accepts a complete server-confirmed value only if its observation is still current. */
  public acceptConfirmed(
    uid: string,
    sessionVersion: number,
    settings: CarSettings | undefined,
    options: CarSettingsStorageOptions,
  ): CarSettings | null {
    if (options.canRun && !options.canRun()) return null;
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    const remoteRevision = options.remoteReadRevision;
    if (remoteRevision !== undefined) {
      if (remoteRevision < (this.acceptedRemoteRevisions.get(scopeKey) ?? 0)) return null;
      this.acceptedRemoteRevisions.set(scopeKey, remoteRevision);
    }

    const drafts =
      this.pendingDrafts.get(scopeKey) ?? new Map<keyof CarSettings, CarSettingsDraft>();
    for (const [field, value] of Object.entries(options.acknowledgedDraftRevisions ?? {})) {
      if (
        (field === 'gasolineAutonomy' || field === 'alcoholAutonomy') &&
        drafts.get(field)?.revision === value
      ) {
        drafts.delete(field);
      }
    }
    if (drafts.size === 0) this.pendingDrafts.delete(scopeKey);
    else this.pendingDrafts.set(scopeKey, drafts);

    const confirmed = settings ?? { ...EMPTY_CAR_SETTINGS };
    this.confirmedSettings.set(scopeKey, {
      exists: settings !== undefined,
      settings: { ...confirmed },
    });
    const effective = this.withDrafts(confirmed, drafts);
    this.setCached(uid, sessionVersion, effective);

    const storageKey = carSettingsStorageKey(uid);
    const snapshot = settings || drafts.size > 0 ? JSON.stringify(effective) : null;
    void this.enqueueWrite(storageKey, async () => {
      if (options.canRun && !options.canRun()) return;
      if (
        remoteRevision !== undefined &&
        remoteRevision < (this.acceptedRemoteRevisions.get(scopeKey) ?? 0)
      ) {
        return;
      }
      if (snapshot === null) await AsyncStorage.removeItem(storageKey);
      else await AsyncStorage.setItem(storageKey, snapshot);
    });
    return effective;
  }

  public invalidate(
    uid: string,
    sessionVersion: number,
    options?: CarSettingsStorageOptions,
  ): Promise<void> {
    this.acceptConfirmed(uid, sessionVersion, undefined, options ?? {});
    return this.writeQueues.get(carSettingsStorageKey(uid)) ?? Promise.resolve();
  }

  private persist(
    uid: string | null,
    sessionVersion: number,
    settings: CarSettings | null,
    options?: CarSettingsStorageOptions,
  ): Promise<void> {
    const storageKey = carSettingsStorageKey(uid);
    const scopeKey = memoryScopeKey(uid, sessionVersion);
    if (options?.canRun && !options.canRun()) return Promise.resolve();
    const remoteRevision = options?.remoteReadRevision;
    if (remoteRevision !== undefined) {
      if (remoteRevision < (this.acceptedRemoteRevisions.get(scopeKey) ?? 0)) {
        return Promise.resolve();
      }
      this.acceptedRemoteRevisions.set(scopeKey, remoteRevision);
    }
    const snapshot = settings ? JSON.stringify(settings) : null;
    this.setCached(uid, sessionVersion, settings ?? EMPTY_CAR_SETTINGS);
    return this.enqueueWrite(storageKey, async () => {
      if (options?.canRun && !options.canRun()) return;
      if (snapshot === null) await AsyncStorage.removeItem(storageKey);
      else await AsyncStorage.setItem(storageKey, snapshot);
    });
  }

  private async waitForWrites(storageKey: string, canRun?: () => boolean): Promise<void> {
    while (true) {
      const pending = this.writeQueues.get(storageKey);
      if (!pending) return;
      await pending;
      if (canRun && !canRun()) return;
      if (this.writeQueues.get(storageKey) === pending) continue;
    }
  }

  private enqueueWrite(storageKey: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.writeQueues.get(storageKey) ?? Promise.resolve();
    let queued!: Promise<void>;
    queued = previous
      .catch(() => undefined)
      .then(operation)
      .catch((error) => {
        if (__DEV__) console.warn('[CarSettingsStorage] Falha ao salvar dados do carro.', error);
      })
      .finally(() => {
        if (this.writeQueues.get(storageKey) === queued) this.writeQueues.delete(storageKey);
      });
    this.writeQueues.set(storageKey, queued);
    return queued;
  }

  private readLocalValue(storageKey: string): Promise<string | null> {
    const existingRead = this.localReads.get(storageKey);
    if (existingRead) return existingRead;
    const read = AsyncStorage.getItem(storageKey);
    this.localReads.set(storageKey, read);
    void read.then(
      () => {
        if (this.localReads.get(storageKey) === read) this.localReads.delete(storageKey);
      },
      () => {
        if (this.localReads.get(storageKey) === read) this.localReads.delete(storageKey);
      },
    );
    return read;
  }

  private withDrafts(
    settings: CarSettings,
    drafts: ReadonlyMap<keyof CarSettings, CarSettingsDraft>,
  ): CarSettings {
    const effective = { ...settings };
    for (const [field, draft] of drafts) effective[field] = draft.value;
    return effective;
  }

  private advanceCacheRevision(scopeKey: string): number {
    const revision = (this.cacheRevisions.get(scopeKey) ?? 0) + 1;
    this.cacheRevisions.set(scopeKey, revision);
    return revision;
  }
}

export function carSettingsStorageKey(uid: string | null): string {
  const scope = uid ? `user:${uid}` : 'anonymous';
  return `${CAR_SETTINGS_STORAGE_KEY_PREFIX}${encodeURIComponent(scope)}`;
}

function memoryScopeKey(uid: string | null, sessionVersion: number): string {
  return `${carSettingsStorageKey(uid)}:${sessionVersion}`;
}

export const carSettingsStorage = new CarSettingsStorage();
