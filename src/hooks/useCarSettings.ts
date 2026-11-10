import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ENABLE_FIRESTORE_CAR_SETTINGS } from '@/config/featureFlags';
import { useAuth } from '@/providers';
import { isActiveAuthSession } from '@/services/auth/ActiveAuthSession';
import {
  carSettingsStorage,
  EMPTY_CAR_SETTINGS,
  firestoreCarSettingsDataSource,
  type CarSettings,
  type FirestoreCarSettingsLoadResult,
} from '@/services/car';

type UseCarSettingsOptions = {
  allowCachedInitial?: boolean;
  syncRemote?: boolean;
};

type CarSettingsRemoteStatus = 'disabled' | 'loading' | 'ready' | 'failed';

type CarSettingsSessionState = {
  sessionKey: string;
  settings: CarSettings;
  isHydrated: boolean;
  remoteStatus: CarSettingsRemoteStatus;
};

type DirtyCarField = {
  value: string;
  revision: number;
  storageRevision: number;
};

export function useCarSettings(options: UseCarSettingsOptions = {}) {
  const { user, sessionVersion } = useAuth();
  const userId = user?.id ?? null;
  const currentSessionVersion = sessionVersion ?? 0;
  const canPersistSession = useCallback(
    () => isActiveAuthSession(userId, currentSessionVersion),
    [currentSessionVersion, userId],
  );
  const sessionKey = createSessionKey(userId, currentSessionVersion);
  const allowCachedInitial = options.allowCachedInitial ?? false;
  const syncRemote = options.syncRemote ?? true;
  const remoteEnabled = Boolean(userId && syncRemote && ENABLE_FIRESTORE_CAR_SETTINGS);
  const cachedSettings = useMemo(
    () => carSettingsStorage.getCached(userId, currentSessionVersion),
    [currentSessionVersion, userId],
  );
  const useCachedInitial = allowCachedInitial && cachedSettings !== null;
  const sessionGeneration = useRef<{ sessionKey: string } | null>(null);
  const dirtySessionKeyRef = useRef(sessionKey);
  const dirtyFields = useRef(new Map<keyof CarSettings, DirtyCarField>());
  const revision = useRef(0);
  const dispatchedRevision = useRef(0);
  const confirmedRemote = useRef<FirestoreCarSettingsLoadResult | null>(null);
  const initialState = useMemo<CarSettingsSessionState>(
    () => ({
      sessionKey,
      settings: cachedSettings ?? { ...EMPTY_CAR_SETTINGS },
      isHydrated: useCachedInitial,
      remoteStatus: remoteEnabled ? 'loading' : 'disabled',
    }),
    [cachedSettings, remoteEnabled, sessionKey, useCachedInitial],
  );
  const [storedState, setStoredState] = useState(initialState);
  const storedStateRef = useRef(storedState);
  const state = storedState.sessionKey === sessionKey ? storedState : initialState;

  useLayoutEffect(() => {
    const generation = { sessionKey };
    sessionGeneration.current = generation;
    confirmedRemote.current = null;
    if (dirtySessionKeyRef.current !== sessionKey) {
      dirtySessionKeyRef.current = sessionKey;
      dirtyFields.current.clear();
      revision.current = 0;
      dispatchedRevision.current = 0;
    }
    return () => {
      sessionGeneration.current = null;
    };
  }, [remoteEnabled, sessionKey, syncRemote, useCachedInitial]);

  useEffect(() => {
    const generation = sessionGeneration.current;
    let active = true;
    let stopWatching: (() => void) | undefined;
    const canRun = () => active && generation === sessionGeneration.current && canPersistSession();
    const initialSettings = cachedSettings ?? { ...EMPTY_CAR_SETTINGS };
    const sessionState: CarSettingsSessionState = {
      sessionKey,
      settings: initialSettings,
      isHydrated: useCachedInitial,
      remoteStatus: remoteEnabled ? 'loading' : 'disabled',
    };
    storedStateRef.current = sessionState;

    if (useCachedInitial && !syncRemote) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      let localSettings: CarSettings;
      try {
        localSettings = await carSettingsStorage.load(userId, currentSessionVersion, { canRun });
      } catch {
        localSettings = initialSettings;
      }
      if (!canRun()) return;

      const localState = withDirtyFields(
        {
          sessionKey,
          settings: localSettings,
          isHydrated: true,
          remoteStatus: remoteEnabled ? 'loading' : 'disabled',
        },
        dirtyFields.current,
      );
      storedStateRef.current = localState;
      setStoredState(localState);

      if (!remoteEnabled || !userId) return;

      const remoteReadRevision = carSettingsStorage.beginRemoteRead();
      const applyConfirmation = (
        remote: FirestoreCarSettingsLoadResult,
        confirmationRevision: number,
      ) => {
        if (!canPersistSession() || remote.source !== 'server') return;
        const acceptedSettings = carSettingsStorage.acceptConfirmed(
          userId,
          currentSessionVersion,
          remote.exists ? remote.settings : undefined,
          { canRun: canPersistSession, remoteReadRevision: confirmationRevision },
        );
        if (!canRun()) return;
        let currentSettings = acceptedSettings;
        let confirmed = remote;
        if (!currentSettings) {
          const latest = carSettingsStorage.getConfirmed(userId, currentSessionVersion);
          if (!latest) return;
          confirmed = { ...latest, source: 'server' };
          currentSettings =
            carSettingsStorage.getCached(userId, currentSessionVersion) ?? latest.settings;
        }
        confirmedRemote.current = confirmed;
        const remoteState = withDirtyFields(
          {
            sessionKey,
            settings: currentSettings,
            isHydrated: true,
            remoteStatus: 'ready',
          },
          dirtyFields.current,
        );
        storedStateRef.current = remoteState;
        setStoredState(remoteState);
      };
      const handleReadFailure = (error: unknown) => {
        if (!canRun()) return;
        if (__DEV__) console.warn('[useCarSettings] Firestore fallback local.', error);
        const failedState = {
          ...storedStateRef.current,
          sessionKey,
          isHydrated: true,
          remoteStatus: 'failed' as const,
        };
        storedStateRef.current = failedState;
        setStoredState(failedState);
      };
      try {
        const remote = await firestoreCarSettingsDataSource.loadWithMetadata(userId, { canRun });
        if (!canRun() || !remote) return;
        if (remote.source === 'server') {
          applyConfirmation(remote, remoteReadRevision);
          return;
        }

        let unsubscribeReady = false;
        let unsubscribeRequested = false;
        let unsubscribeWatch: (() => void) | undefined;
        const stopWatchOnce = () => {
          if (unsubscribeRequested) return;
          unsubscribeRequested = true;
          if (unsubscribeReady) unsubscribeWatch?.();
        };
        stopWatching = stopWatchOnce;
        const handleWatchResult = (callback: () => void) => {
          if (!canRun() || unsubscribeRequested) return;
          stopWatchOnce();
          stopWatching = undefined;
          callback();
        };
        unsubscribeWatch = firestoreCarSettingsDataSource.watchForConfirmation(
          userId,
          (confirmed) => {
            handleWatchResult(() =>
              applyConfirmation(confirmed, carSettingsStorage.beginRemoteRead()),
            );
          },
          (error) => {
            handleWatchResult(() => handleReadFailure(error));
          },
        );
        unsubscribeReady = true;
        if (unsubscribeRequested) unsubscribeWatch();
      } catch (error) {
        handleReadFailure(error);
      }
    })();

    return () => {
      active = false;
      stopWatching?.();
      stopWatching = undefined;
    };
  }, [
    cachedSettings,
    canPersistSession,
    currentSessionVersion,
    remoteEnabled,
    sessionKey,
    syncRemote,
    useCachedInitial,
    userId,
  ]);

  useEffect(() => {
    if (
      !remoteEnabled ||
      !userId ||
      state.remoteStatus !== 'ready' ||
      storedState.sessionKey !== sessionKey ||
      dirtyFields.current.size === 0
    ) {
      return;
    }

    const generation = sessionGeneration.current;
    const canRun = () => generation === sessionGeneration.current && canPersistSession();
    const flushEdits = async () => {
      const confirmed = confirmedRemote.current;
      if (!canRun() || !confirmed) return;
      const edits = [...dirtyFields.current.entries()].filter(
        ([, change]) => change.revision > dispatchedRevision.current,
      );
      if (edits.length === 0) return;
      const writeRevision = revision.current;
      dispatchedRevision.current = writeRevision;
      const changes = Object.fromEntries(
        edits.map(([field, change]) => [field, change.value]),
      ) as Partial<CarSettings>;
      const acknowledgedDraftRevisions = Object.fromEntries(
        edits.map(([field, change]) => [field, change.storageRevision]),
      ) as Partial<Record<keyof CarSettings, number>>;
      const mutationRevision = carSettingsStorage.beginRemoteRead();

      try {
        const writeResult = await firestoreCarSettingsDataSource.saveFields(
          userId,
          changes,
          !confirmed.exists,
          { canRun, canPersist: canPersistSession },
        );
        if (!writeResult) return;
        if (!canPersistSession()) return;

        let acceptedSettings =
          writeResult.kind === 'snapshot'
            ? carSettingsStorage.acceptConfirmed(
                userId,
                currentSessionVersion,
                writeResult.settings,
                {
                  canRun: canPersistSession,
                  remoteReadRevision: mutationRevision,
                  acknowledgedDraftRevisions,
                },
              )
            : carSettingsStorage.acceptPatch(userId, currentSessionVersion, writeResult.changes, {
                canRun: canPersistSession,
                remoteReadRevision: mutationRevision,
                acknowledgedDraftRevisions,
              });

        if (!canRun()) {
          if (!acceptedSettings) {
            await carSettingsStorage.resolveAcknowledgedDrafts(
              userId,
              currentSessionVersion,
              acknowledgedDraftRevisions,
              { canRun: canPersistSession },
            );
          }
          return;
        }

        if (!acceptedSettings) {
          const refreshRevision = carSettingsStorage.beginRemoteRead();
          try {
            const latest = await firestoreCarSettingsDataSource.loadWithMetadata(userId, {
              canRun: canPersistSession,
            });
            if (!canPersistSession()) return;
            if (!canRun()) {
              if (latest?.source === 'server') {
                acceptedSettings = carSettingsStorage.acceptConfirmed(
                  userId,
                  currentSessionVersion,
                  latest.exists ? latest.settings : undefined,
                  {
                    canRun: canPersistSession,
                    remoteReadRevision: refreshRevision,
                    acknowledgedDraftRevisions,
                  },
                );
              }
              if (!acceptedSettings) {
                await carSettingsStorage.resolveAcknowledgedDrafts(
                  userId,
                  currentSessionVersion,
                  acknowledgedDraftRevisions,
                  { canRun: canPersistSession },
                );
              }
              return;
            }
            if (latest?.source === 'server') {
              acceptedSettings = carSettingsStorage.acceptConfirmed(
                userId,
                currentSessionVersion,
                latest.exists ? latest.settings : undefined,
                {
                  canRun: canPersistSession,
                  remoteReadRevision: refreshRevision,
                  acknowledgedDraftRevisions,
                },
              );
            }
          } catch {
            if (!canPersistSession()) return;
            if (!canRun()) {
              await carSettingsStorage.resolveAcknowledgedDrafts(
                userId,
                currentSessionVersion,
                acknowledgedDraftRevisions,
                { canRun: canPersistSession },
              );
              return;
            }
          }
        }
        await carSettingsStorage.resolveAcknowledgedDrafts(
          userId,
          currentSessionVersion,
          acknowledgedDraftRevisions,
          { canRun: canPersistSession },
        );
        if (!canRun()) return;
        const latest = carSettingsStorage.getConfirmed(userId, currentSessionVersion);
        if (!latest) return;
        confirmedRemote.current = { ...latest, source: 'server' };
        for (const [field, change] of edits) {
          if (dirtyFields.current.get(field)?.revision === change.revision) {
            dirtyFields.current.delete(field);
          }
        }
        const confirmedSettings =
          carSettingsStorage.getCached(userId, currentSessionVersion) ??
          acceptedSettings ??
          confirmedRemote.current.settings;
        const nextState = withDirtyFields(
          {
            ...storedStateRef.current,
            settings: confirmedSettings,
          },
          dirtyFields.current,
        );
        storedStateRef.current = nextState;
        setStoredState(nextState);
      } catch (error) {
        if (canRun() && __DEV__) console.warn('[useCarSettings] Firestore save failed.', error);
      } finally {
        if (canRun() && revision.current > writeRevision) void flushEdits();
      }
    };
    void flushEdits();
  }, [
    canPersistSession,
    currentSessionVersion,
    remoteEnabled,
    sessionKey,
    state.remoteStatus,
    state.settings,
    storedState.sessionKey,
    userId,
  ]);

  const updateField = useCallback(
    <K extends keyof CarSettings>(field: K, value: CarSettings[K]) => {
      if (sessionGeneration.current?.sessionKey !== sessionKey) return;
      const nextRevision = revision.current + 1;
      revision.current = nextRevision;
      const draft = carSettingsStorage.recordDraft(
        userId,
        currentSessionVersion,
        { [field]: value },
        { canRun: canPersistSession },
      );
      dirtyFields.current.set(field, {
        value,
        revision: nextRevision,
        storageRevision: draft.revisions[field] ?? 0,
      });
      void draft.persisted;
      const currentState =
        storedStateRef.current.sessionKey === sessionKey ? storedStateRef.current : initialState;
      const nextState: CarSettingsSessionState = {
        ...currentState,
        sessionKey,
        settings: { ...currentState.settings, [field]: value },
        isHydrated: true,
      };
      storedStateRef.current = nextState;
      setStoredState(nextState);
    },
    [canPersistSession, currentSessionVersion, initialState, sessionKey, userId],
  );

  return { isHydrated: state.isHydrated, settings: state.settings, updateField };
}

function withDirtyFields(
  state: CarSettingsSessionState,
  changes: ReadonlyMap<keyof CarSettings, DirtyCarField>,
): CarSettingsSessionState {
  const settings = { ...state.settings };
  for (const [field, change] of changes) settings[field] = change.value;
  return { ...state, settings };
}

function createSessionKey(uid: string | null, sessionVersion: number): string {
  return `${uid ?? 'anonymous'}:${sessionVersion}`;
}
