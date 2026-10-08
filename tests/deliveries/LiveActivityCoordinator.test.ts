import type {
  CompleteDeliveryDateSnapshot,
  DeliveryDateSnapshotEvent,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import type { Delivery } from '@/types/data';
import { LiveActivityCoordinator } from '@/features/deliveries/liveActivity/LiveActivityCoordinator';
import type {
  LiveActivityContent,
  LiveActivityDriver,
  LiveActivityInstance,
  LiveActivityOwnership,
  LiveActivityOwnershipStore,
} from '@/features/deliveries/liveActivity/LiveActivityContracts';
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

const TODAY = '2026-10-03';

function delivery(id: string, quantity = 2): Delivery {
  return {
    id,
    cliente: `Cliente ${id}`,
    quantidade: quantity,
    valor: quantity * 25,
    status: 'Não Pago',
    entregue: false,
    data: TODAY,
  };
}

function snapshot(
  uid = 'user-a',
  items: Delivery[] = [delivery('one')],
): CompleteDeliveryDateSnapshot {
  return { uid, date: TODAY, deliveries: items, completedAt: Date.now() };
}

class FakeSnapshotSource {
  public current: CompleteDeliveryDateSnapshot | null = null;
  private readonly listeners = new Set<(event: DeliveryDateSnapshotEvent) => void>();
  public readonly load = jest.fn(
    async (uid: string, filters: { mode: string; date?: string }): Promise<Delivery[]> => {
      if (this.current && this.current.uid === uid && this.current.date === filters.date) {
        this.emit({ type: 'complete', snapshot: this.current });
      }
      return [];
    },
  );

  public subscribeDateSnapshots(listener: (event: DeliveryDateSnapshotEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getCompleteDateSnapshot(uid: string, date: string) {
    return this.current?.uid === uid && this.current.date === date ? this.current : null;
  }

  public setSnapshot(value: CompleteDeliveryDateSnapshot | null) {
    this.current = value;
  }

  public emit(event: DeliveryDateSnapshotEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}

class FakeActivity implements LiveActivityInstance {
  public ended = false;
  public failUpdate = false;
  public failEnd = false;
  public readonly update = jest.fn(async (content: LiveActivityContent) => {
    if (this.failUpdate) throw new Error('ActivityKit update failed');
    this.content = content;
  });
  public readonly end = jest.fn(async (_policy?: 'default' | 'immediate') => {
    if (this.failEnd) throw new Error('ActivityKit end failed');
    this.ended = true;
    this.removeFromDriver(this.id);
  });

  public constructor(
    private readonly id: string,
    public content: LiveActivityContent,
    private readonly removeFromDriver: (id: string) => void,
  ) {}

  public getId() {
    return this.id;
  }
}

class FakeDriver implements LiveActivityDriver {
  public readonly instances: FakeActivity[] = [];
  public readonly getInstances = jest.fn(() => this.instances.filter((item) => !item.ended));
  public readonly start = jest.fn(
    (content: LiveActivityContent, _url: string, _staleDate?: Date) => {
      const instance = this.add(`activity-${this.instances.length + 1}`, content);
      return instance;
    },
  );
  public failStart = false;

  public add(id: string, content: LiveActivityContent) {
    const instance = new FakeActivity(id, content, (itemId) => {
      const found = this.instances.find((candidate) => candidate.getId() === itemId);
      if (found) found.ended = true;
    });
    this.instances.push(instance);
    return instance;
  }
}

class FakeOwnershipStore implements LiveActivityOwnershipStore {
  public value: LiveActivityOwnership | null = null;
  public failWrite = false;
  public readonly read = jest.fn(async () => this.value);
  public readonly write = jest.fn(async (ownership: LiveActivityOwnership) => {
    if (this.failWrite) throw new Error('Local ownership write failed');
    this.value = ownership;
  });
  public readonly clear = jest.fn(async () => {
    this.value = null;
  });
}

function content(overrides: Partial<LiveActivityContent> = {}): LiveActivityContent {
  return {
    date: TODAY,
    bucketCount: 2,
    deliveryCount: 1,
    isObsolete: false,
    ...overrides,
  };
}

function makeCoordinator(
  source: FakeSnapshotSource,
  driver = new FakeDriver(),
  ownershipStore = new FakeOwnershipStore(),
) {
  const coordinator = new LiveActivityCoordinator({
    source: source as never,
    ownershipStore,
    loadDriver: async () => driver,
    isIOS: true,
    now: () => new Date(2026, 9, 3, 12),
    scheduleMidnightRefresh: false,
  });
  coordinator.attach();
  return { coordinator, driver, ownershipStore };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('LiveActivityCoordinator', () => {
  let attachedCoordinators: LiveActivityCoordinator[];

  beforeEach(() => {
    attachedCoordinators = [];
  });

  afterEach(() => {
    attachedCoordinators.forEach((coordinator) => coordinator.detach());
  });

  it('starts, updates from a complete snapshot, and ends the ActivityKit instance', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    expect(coordinator.getSnapshot()).toMatchObject({ supported: true, canStart: true });
    await expect(coordinator.toggleFromToolbar()).resolves.toEqual({ ok: true });
    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(driver.start).toHaveBeenCalledWith(
      expect.anything(),
      '/historico?mode=wholesale',
      expect.any(Date),
    );
    expect(driver.instances[0]?.content).toEqual({
      date: TODAY,
      bucketCount: 2,
      deliveryCount: 1,
      isObsolete: false,
    });
    expect(ownershipStore.value?.activityId).toBe('activity-1');

    const updated = snapshot('user-a', [delivery('one', 4), delivery('two', 1)]);
    source.setSnapshot(updated);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: updated });
    expect(driver.instances[0]?.content).toMatchObject({ bucketCount: 5, deliveryCount: 2 });

    await expect(coordinator.toggleFromToolbar()).resolves.toEqual({ ok: true });
    expect(driver.instances[0]?.ended).toBe(true);
    expect(ownershipStore.value).toBeNull();
    expect(coordinator.getSnapshot().isActive).toBe(false);
  });

  it('recovers the owned activity, refreshes it, and ends duplicate instances', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const driver = new FakeDriver();
    const first = driver.add('known-activity', content({ bucketCount: 7 }));
    const duplicate = driver.add('duplicate-activity', content());
    const ownershipStore = new FakeOwnershipStore();
    ownershipStore.value = {
      uid: 'user-a',
      activityId: 'known-activity',
      content: first.content,
    };
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(driver.start).not.toHaveBeenCalled();
    expect(first.ended).toBe(false);
    expect(duplicate.ended).toBe(true);
    expect(driver.getInstances()).toEqual([first]);
    expect(first.content).toMatchObject({ bucketCount: 2, deliveryCount: 1, isObsolete: false });
    expect(driver.start).not.toHaveBeenCalled();
  });

  it('serializes simultaneous toggles against the latest active state without duplicate starts', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    const results = await Promise.all([
      coordinator.toggleFromToolbar(),
      coordinator.toggleFromToolbar(),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(driver.getInstances()).toHaveLength(0);
  });

  it('invalidates canStart synchronously when foreground reconciliation begins without an active activity', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    expect(coordinator.getSnapshot().canStart).toBe(true);

    const loadStarted = deferred<void>();
    const loadResult = deferred<Delivery[]>();
    source.load.mockImplementationOnce(async (uid, filters) => {
      loadStarted.resolve();
      await loadResult.promise;
      if (source.current) source.emit({ type: 'complete', snapshot: source.current });
      return [];
    });

    const foreground = (
      coordinator as unknown as { handleForeground: () => Promise<void> }
    ).handleForeground();

    expect(coordinator.getSnapshot().canStart).toBe(false);
    await loadStarted.promise;
    expect(coordinator.getSnapshot().canStart).toBe(false);

    loadResult.resolve([]);
    await foreground;

    expect(coordinator.getSnapshot().canStart).toBe(true);
  });

  it('keeps an active activity stoppable while foreground waits for a complete snapshot', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    await coordinator.toggleFromToolbar();
    const active = driver.instances[0];
    if (!active) throw new Error('Expected a started fake activity.');
    source.setSnapshot(null);

    const loadStarted = deferred<void>();
    const loadResult = deferred<Delivery[]>();
    source.load.mockImplementationOnce(async () => {
      loadStarted.resolve();
      return loadResult.promise;
    });

    const foreground = (
      coordinator as unknown as { handleForeground: () => Promise<void> }
    ).handleForeground();
    await loadStarted.promise;

    expect(coordinator.getSnapshot()).toMatchObject({ isActive: true, canStart: false });
    await expect(coordinator.toggleFromToolbar()).resolves.toEqual({ ok: true });
    expect(active.ended).toBe(true);

    loadResult.resolve([]);
    await foreground;
    expect(coordinator.getSnapshot().isActive).toBe(false);
  });

  it('adopts and refreshes an activity found during the serialized start action without duplicating it', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const driver = new FakeDriver();
    const ownershipStore = new FakeOwnershipStore();
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    const existing = driver.add('late-existing-activity', content({ bucketCount: 8 }));
    ownershipStore.value = {
      uid: 'user-a',
      activityId: 'late-existing-activity',
      content: existing.content,
    };

    await expect(coordinator.toggleFromToolbar()).resolves.toEqual({ ok: true });

    expect(driver.start).not.toHaveBeenCalled();
    expect(driver.getInstances()).toEqual([existing]);
    expect(existing.ended).toBe(false);
    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ bucketCount: 2, deliveryCount: 1, isObsolete: false }),
      expect.any(Date),
    );
    expect(coordinator.getSnapshot().isActive).toBe(true);
  });

  it('uses the state present when the queued action runs and recovers ActivityKit before stopping', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const driver = new FakeDriver();
    const ownershipStore = new FakeOwnershipStore();
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    const queueGate = deferred<void>();
    const internal = coordinator as unknown as {
      enqueue: (operation: () => Promise<void>) => Promise<void>;
      updateState: (patch: { isActive?: boolean }) => void;
    };
    const precedingOperation = internal.enqueue(async () => {
      await queueGate.promise;
      internal.updateState({ isActive: true });
    });
    const action = coordinator.toggleFromToolbar();

    const existing = driver.add('recovered-before-action', content());
    ownershipStore.value = {
      uid: 'user-a',
      activityId: 'recovered-before-action',
      content: existing.content,
    };
    ownershipStore.read.mockClear();
    queueGate.resolve();

    await Promise.all([precedingOperation, action]);

    expect(existing.ended).toBe(true);
    expect(driver.start).not.toHaveBeenCalled();
    expect(driver.getInstances()).toEqual([]);
    expect(ownershipStore.read).toHaveBeenCalledTimes(1);
    expect(existing.end.mock.invocationCallOrder[0]).toBeGreaterThan(
      ownershipStore.read.mock.invocationCallOrder[0] ?? 0,
    );
    expect(coordinator.getSnapshot().isActive).toBe(false);
  });

  it('refuses to start from an unknown or incomplete date snapshot', async () => {
    const source = new FakeSnapshotSource();
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    await expect(coordinator.toggleFromToolbar()).resolves.toMatchObject({ ok: false });

    expect(driver.start).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().canStart).toBe(false);
  });

  it('does not report an activity when instance recovery itself fails', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const driver = new FakeDriver();
    driver.getInstances.mockImplementationOnce(() => {
      throw new Error('ActivityKit unavailable');
    });
    const { coordinator } = makeCoordinator(source, driver);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(coordinator.getSnapshot().isActive).toBe(false);
  });

  it('ends the prior UID activity and clears ownership when the session changes', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot('user-a'));
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    await coordinator.toggleFromToolbar();
    const previous = driver.instances[0];
    source.setSnapshot(snapshot('user-b', [delivery('other-user', 8)]));

    await coordinator.setSession('user-b', 2);

    expect(previous?.ended).toBe(true);
    expect(driver.getInstances()).toEqual([]);
    expect(ownershipStore.value).toBeNull();
    expect(coordinator.getSnapshot().canStart).toBe(true);
    expect(driver.start).toHaveBeenCalledTimes(1);
  });

  it('preserves old counts as obsolete when a full-date query is invalidated', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    await coordinator.toggleFromToolbar();
    await coordinator.handleDateSnapshotEvent({ type: 'invalidated', uid: 'user-a', date: TODAY });

    expect(driver.instances[0]?.content).toEqual({
      date: TODAY,
      bucketCount: 2,
      deliveryCount: 1,
      isObsolete: true,
    });
    expect(coordinator.getSnapshot().canStart).toBe(false);
  });

  it('contains ActivityKit start, update, and end failures', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);

    driver.start.mockImplementationOnce(() => {
      throw new Error('ActivityKit start failed');
    });
    await expect(coordinator.toggleFromToolbar()).resolves.toMatchObject({ ok: false });
    expect(coordinator.getSnapshot().isActive).toBe(false);

    await coordinator.toggleFromToolbar();
    const active = driver.instances[0];
    if (!active) throw new Error('Expected a started fake activity.');
    active.failUpdate = true;
    const newer = snapshot('user-a', [delivery('one', 9)]);
    source.setSnapshot(newer);
    await expect(
      coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: newer }),
    ).resolves.toBeUndefined();
    expect(active.content.bucketCount).toBe(2);
    expect(ownershipStore.value?.content.bucketCount).toBe(2);

    active.failEnd = true;
    await expect(coordinator.toggleFromToolbar()).resolves.toMatchObject({ ok: false });
    expect(coordinator.getSnapshot().isActive).toBe(true);
  });

  it('marks the last known payload obsolete after relaunch before revalidating the date', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(null);
    const driver = new FakeDriver();
    const recovered = driver.add('recovered', content({ bucketCount: 6 }));
    const ownershipStore = new FakeOwnershipStore();
    ownershipStore.value = {
      uid: 'user-a',
      activityId: 'recovered',
      content: recovered.content,
    };
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(recovered.content).toMatchObject({ bucketCount: 6, isObsolete: true });
    expect(coordinator.getSnapshot().isActive).toBe(true);
    expect(coordinator.getSnapshot().canStart).toBe(false);
  });

  it('refreshes ActivityKit instances on foreground and notices normal expiration', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const driver = new FakeDriver();
    const expired = driver.add('expired-activity', content());
    const ownershipStore = new FakeOwnershipStore();
    ownershipStore.value = {
      uid: 'user-a',
      activityId: 'expired-activity',
      content: expired.content,
    };
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);
    expired.ended = true;
    await (coordinator as unknown as { handleForeground: () => Promise<void> }).handleForeground();

    expect(coordinator.getSnapshot()).toMatchObject({ isActive: false, canStart: true });
    expect(ownershipStore.value).toBeNull();
  });
});
