import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useCostSettings } from '@/hooks/useCostSettings';
import { useAuth } from '@/providers';
import {
  COST_SETTINGS_DEFAULT_SCOPE,
  costSettingsStorage,
  firestoreDailyMonthlyDataSource,
  localDailyDataDataSource,
} from '@/services/costs';
import type { CostSettings } from '@/services/costs/CostSettingsStorage';

jest.mock('@/config/featureFlags', () => ({
  ENABLE_FIRESTORE_DAILY_MONTHLY: true,
}));

jest.mock('@/providers', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/costs', () => ({
  addDailyValue: (current: string, added: string) => added || current,
  setDailyValue: (_current: string, next: string) => next,
  COST_SETTINGS_DEFAULT_SCOPE: 'anonymous',
  EMPTY_COST_SETTINGS: { periods: { day: {}, month: {}, year: {} } },
  EMPTY_COST_VALUES: {
    estar: '',
    fuel: '',
    fuelPrice: '',
    fuelType: '',
    kilometers: '',
    light: '',
    other: '',
  },
  costSettingsStorage: { getCached: jest.fn() },
  firestoreDailyMonthlyDataSource: {
    loadAllAsCostSettings: jest.fn(),
    saveSettingsDiff: jest.fn(),
  },
  localDailyDataDataSource: {
    load: jest.fn(),
    save: jest.fn(),
  },
}));

const mockUseAuth = jest.mocked(useAuth);
const mockGetCached = jest.mocked(costSettingsStorage.getCached);
const mockLocalLoad = jest.mocked(localDailyDataDataSource.load);
const mockLocalSave = jest.mocked(localDailyDataDataSource.save);
const mockRemoteLoad = jest.mocked(firestoreDailyMonthlyDataSource.loadAllAsCostSettings);
const mockRemoteSave = jest.mocked(firestoreDailyMonthlyDataSource.saveSettingsDiff);
const remoteWrites: CostSettings[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function settings(
  days: Record<string, Partial<CostSettings['periods']['day'][string]>>,
): CostSettings {
  const defaults = {
    estar: '',
    fuel: '',
    fuelPrice: '6',
    fuelType: 'gasolina',
    kilometers: '',
    light: '',
    other: '',
  };

  return {
    periods: {
      day: Object.fromEntries(
        Object.entries(days).map(([date, values]) => [date, { ...defaults, ...values }]),
      ),
      month: {},
      year: {},
    },
  };
}

function Harness({ onRender }: { onRender: (value: ReturnType<typeof useCostSettings>) => void }) {
  onRender(useCostSettings());
  return null;
}

describe('useCostSettings local-first session flow', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, sessionVersion: 0 } as never);
    mockGetCached.mockReturnValue(null);
    mockLocalLoad.mockReset().mockResolvedValue(settings({}));
    mockLocalSave.mockReset().mockResolvedValue(undefined);
    mockRemoteLoad.mockReset().mockResolvedValue(settings({}));
    remoteWrites.length = 0;
    mockRemoteSave.mockReset().mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as
        { beforeWrite?: Promise<boolean>; canRun?: () => boolean } | undefined;
      if (options?.beforeWrite && !(await options.beforeWrite)) return;
      if (options?.canRun && !options.canRun()) return;
      if (JSON.stringify(args[1]) !== JSON.stringify(args[2])) {
        remoteWrites.push(args[2] as CostSettings);
      }
    });
  });

  it('updates and persists locally before remote hydration finishes', async () => {
    const remote = deferred<CostSettings>();
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockReturnValue(remote.promise);

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('30');
    expect(mockLocalSave).toHaveBeenCalledWith(
      expect.objectContaining({ periods: expect.anything() }),
      'user-1',
      expect.objectContaining({ canRun: expect.any(Function) }),
    );
    expect(mockRemoteSave).not.toHaveBeenCalled();

    await act(async () => {
      remote.resolve(settings({ '2026-09-02': { kilometers: '20', fuel: '7' } }));
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02')).toMatchObject({ kilometers: '30', fuel: '7' });
    expect(mockRemoteSave).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ periods: expect.anything() }),
      expect.objectContaining({ periods: expect.anything() }),
      expect.objectContaining({ beforeWrite: expect.any(Promise), canRun: expect.any(Function) }),
    );

    await act(async () => renderer?.unmount());
  });

  it('keeps every field of a local-only record when the remote snapshot arrives', async () => {
    const remote = deferred<CostSettings>();
    const local = settings({
      '2026-09-02': { kilometers: '10', fuel: 'local-fuel', light: 'local-light' },
    });
    mockLocalLoad.mockResolvedValue(local);
    mockRemoteLoad.mockReturnValue(remote.promise);

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      remote.resolve(settings({}));
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02')).toMatchObject({
      kilometers: '30',
      fuel: 'local-fuel',
      light: 'local-light',
    });

    await act(async () => renderer?.unmount());
  });

  it('does not discard a complete local-only record when remote has no record', async () => {
    const local = settings({
      '2026-09-02': { kilometers: '10', fuel: 'local-fuel', light: 'local-light' },
    });
    mockLocalLoad.mockResolvedValue(local);
    mockRemoteLoad.mockResolvedValue(settings({}));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    await act(async () => {
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02')).toMatchObject({
      kilometers: '10',
      fuel: 'local-fuel',
      light: 'local-light',
    });
    await act(async () => renderer?.unmount());
  });

  it('hydrates remote fields that were not edited locally', async () => {
    const remote = deferred<CostSettings>();
    mockLocalLoad.mockResolvedValue(
      settings({ '2026-09-02': { kilometers: '10', fuel: 'local' } }),
    );
    mockRemoteLoad.mockReturnValue(remote.promise);

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });
    await act(async () => {
      remote.resolve(settings({ '2026-09-02': { kilometers: '20', fuel: 'remote' } }));
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02')).toMatchObject({
      kilometers: '30',
      fuel: 'remote',
    });
    await act(async () => renderer?.unmount());
  });

  it('keeps the newest local revision across two rapid edits', async () => {
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '20' } }));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      current?.updateField('day', '2026-09-02', 'kilometers', '40');
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('40');
    expect(mockLocalSave.mock.calls.at(-1)?.[0]).toMatchObject({
      periods: { day: { '2026-09-02': { kilometers: '40' } } },
    });
    await act(async () => renderer?.unmount());
  });

  it('does not clear local intent when remote sync fails and retries on a later edit', async () => {
    const remoteError = new Error('offline');
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '20' } }));
    mockRemoteSave.mockRejectedValue(remoteError);

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });
    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('30');

    mockRemoteSave.mockResolvedValue(undefined);
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'fuel', '9');
      await settle();
    });

    expect(mockRemoteSave.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(current?.getValues('day', '2026-09-02')).toMatchObject({ kilometers: '30', fuel: '9' });
    await act(async () => renderer?.unmount());
  });

  it('does not treat a failed local save as a remotely synchronized edit', async () => {
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '20' } }));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    remoteWrites.length = 0;
    mockLocalSave.mockRejectedValue(new Error('storage unavailable'));
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('30');
    expect(remoteWrites).toEqual([]);
    await act(async () => renderer?.unmount());
  });

  it('does not publish a local save after logout while persistence is pending', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-1' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '20' } }));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    const localWrite = deferred<void>();
    mockLocalSave.mockReset().mockReturnValue(localWrite.promise);
    remoteWrites.length = 0;
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });

    authState = { user: null, sessionVersion: 1 };
    mockLocalLoad.mockResolvedValue(settings({}));
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    localWrite.resolve();
    await act(async () => {
      await settle();
    });

    expect(remoteWrites).toEqual([]);
    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('');
    await act(async () => renderer?.unmount());
  });

  it('does not apply or publish a remote save after logout while the write is pending', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-1' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '20' } }));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    const remoteWrite = deferred<void>();
    mockRemoteSave.mockReset().mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as
        { beforeWrite?: Promise<boolean>; canRun?: () => boolean } | undefined;
      if (options?.beforeWrite && !(await options.beforeWrite)) return;
      await remoteWrite.promise;
      if (options?.canRun && !options.canRun()) return;
      remoteWrites.push(args[2] as CostSettings);
    });
    remoteWrites.length = 0;
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });

    authState = { user: null, sessionVersion: 1 };
    mockLocalLoad.mockResolvedValue(settings({}));
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    remoteWrite.resolve();
    await act(async () => {
      await settle();
    });

    expect(remoteWrites).toEqual([]);
    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('');
    await act(async () => renderer?.unmount());
  });

  it('does not apply an already-dispatched remote save after relogin with the same UID', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-1' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    mockLocalLoad
      .mockReset()
      .mockResolvedValueOnce(settings({ '2026-09-02': { kilometers: '10' } }))
      .mockResolvedValue(settings({ '2026-09-02': { kilometers: '11' } }));
    mockRemoteLoad
      .mockReset()
      .mockResolvedValueOnce(settings({ '2026-09-02': { kilometers: '20' } }))
      .mockResolvedValue(settings({ '2026-09-02': { kilometers: '22' } }));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    const remoteWrite = deferred<void>();
    let oldSaveStarted = false;
    remoteWrites.length = 0;
    mockRemoteSave.mockClear();
    mockRemoteSave
      .mockImplementationOnce(async (...args: unknown[]) => {
        oldSaveStarted = true;
        const options = args[3] as
          { beforeWrite?: Promise<boolean>; canRun?: () => boolean } | undefined;
        if (options?.beforeWrite && !(await options.beforeWrite)) return;
        await remoteWrite.promise;
        if (options?.canRun && !options.canRun()) return;
        remoteWrites.push(args[2] as CostSettings);
      })
      .mockImplementation(async (...args: unknown[]) => {
        const options = args[3] as
          { beforeWrite?: Promise<boolean>; canRun?: () => boolean } | undefined;
        if (options?.beforeWrite && !(await options.beforeWrite)) return;
        if (options?.canRun && !options.canRun()) return;
      });

    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });
    expect(oldSaveStarted).toBe(true);

    authState = { user: { id: 'user-1' }, sessionVersion: 1 };
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('22');
    remoteWrite.resolve();
    await act(async () => {
      await settle();
    });

    expect(remoteWrites).toEqual([]);
    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('22');
    await act(async () => renderer?.unmount());
  });

  it('does not report a daily deletion as saved when local persistence fails', async () => {
    mockLocalLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));
    mockRemoteLoad.mockResolvedValue(settings({ '2026-09-02': { kilometers: '10' } }));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    mockLocalSave.mockReset().mockRejectedValue(new Error('storage unavailable'));
    remoteWrites.length = 0;
    let result: boolean | undefined;
    await act(async () => {
      result = await current?.deleteDailyData('2026-09-02');
      await settle();
    });

    expect(result).toBe(false);
    expect(remoteWrites).toEqual([]);
    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('');
    await act(async () => renderer?.unmount());
  });

  it('does not apply hydration from UID A after switching to UID B', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-a' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    mockGetCached.mockImplementation((scope) => (scope === 'user-b' ? settings({}) : null));
    mockLocalLoad.mockImplementation((scope) =>
      Promise.resolve(
        scope === 'user-b'
          ? settings({ '2026-09-02': { kilometers: '2' } })
          : settings({ '2026-09-02': { kilometers: '1' } }),
      ),
    );
    const remoteA = deferred<CostSettings>();
    mockRemoteLoad.mockReturnValueOnce(remoteA.promise).mockResolvedValue(settings({}));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    authState = { user: { id: 'user-b' }, sessionVersion: 1 };
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    remoteA.resolve(settings({ '2026-09-02': { kilometers: '99' } }));
    await act(async () => {
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('2');
    expect(mockGetCached).toHaveBeenCalledWith('user-b');
    await act(async () => renderer?.unmount());
  });

  it('starts a new local hydration when the same UID gets a new session', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-1' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    const firstLocal = deferred<CostSettings>();
    mockLocalLoad
      .mockReset()
      .mockReturnValueOnce(firstLocal.promise)
      .mockResolvedValueOnce(settings({ '2026-09-02': { kilometers: '2' } }));
    mockRemoteLoad.mockReset().mockResolvedValue(settings({}));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    authState = { user: { id: 'user-1' }, sessionVersion: 1 };
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    expect(mockLocalLoad).toHaveBeenCalledTimes(2);
    firstLocal.reject(new Error('old session read failed'));
    await act(async () => {
      await settle();
    });

    expect(current?.getValues('day', '2026-09-02').kilometers).toBe('2');
    await act(async () => renderer?.unmount());
  });

  it('resets remote readiness before hydrating a new generation of the same UID', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-1' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    const nextRemote = deferred<CostSettings>();
    mockLocalLoad.mockReset().mockResolvedValue(settings({}));
    mockRemoteLoad
      .mockReset()
      .mockResolvedValueOnce(settings({}))
      .mockReturnValueOnce(nextRemote.promise);

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    mockRemoteSave.mockClear();

    authState = { user: { id: 'user-1' }, sessionVersion: 1 };
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    await act(async () => {
      current?.updateField('day', '2026-09-02', 'kilometers', '30');
      await settle();
    });

    expect(mockRemoteSave).not.toHaveBeenCalled();
    nextRemote.resolve(settings({}));
    await act(async () => {
      await settle();
    });

    expect(mockRemoteSave).toHaveBeenCalled();
    await act(async () => renderer?.unmount());
  });

  it('starts a new hydration cycle after relogin with the same UID', async () => {
    let authState: { user: { id: string } | null; sessionVersion: number } = {
      user: { id: 'user-1' },
      sessionVersion: 0,
    };
    mockUseAuth.mockImplementation(() => authState as never);
    const firstRemote = deferred<CostSettings>();
    mockRemoteLoad.mockReturnValueOnce(firstRemote.promise).mockResolvedValue(settings({}));

    let current: ReturnType<typeof useCostSettings> | undefined;
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });

    authState = { user: { id: 'user-1' }, sessionVersion: 1 };
    await act(async () => {
      renderer?.update(createElement(Harness, { onRender: (value) => (current = value) }));
      await settle();
    });
    expect(mockRemoteLoad).toHaveBeenCalledTimes(2);
    firstRemote.resolve(settings({ '2026-09-02': { kilometers: '99' } }));
    await act(async () => {
      await settle();
    });
    expect(current?.getValues('day', '2026-09-02').kilometers).not.toBe('99');
    await act(async () => renderer?.unmount());
  });

  it('uses the anonymous scope only when no UID is available', async () => {
    mockUseAuth.mockReturnValue({ user: null, sessionVersion: 0 } as never);
    mockLocalLoad.mockResolvedValue(settings({}));

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(createElement(Harness, { onRender: () => undefined }));
      await settle();
    });
    expect(mockLocalLoad).toHaveBeenCalledWith(
      COST_SETTINGS_DEFAULT_SCOPE,
      expect.objectContaining({ canRun: expect.any(Function) }),
    );
    await act(async () => renderer?.unmount());
  });
});
