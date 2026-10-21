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

function delivery(id: string, quantity = 2, delivered = false): Delivery {
  return {
    id,
    cliente: `Cliente ${id}`,
    quantidade: quantity,
    valor: quantity * 25,
    status: 'Não Pago',
    entregue: delivered,
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
  public readonly end = jest.fn(
    async (
      _policy?: 'default' | 'immediate',
      content?: LiveActivityContent,
      _contentDate?: Date,
    ) => {
      if (this.failEnd) throw new Error('ActivityKit end failed');
      if (content) this.content = content;
      this.ended = true;
      this.removeFromDriver(this.id);
    },
  );

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
    completedDeliveryCount: 0,
    totalDeliveryCount: 1,
    isObsolete: false,
    ...overrides,
  };
}

function makeCoordinator(
  source: FakeSnapshotSource,
  driver = new FakeDriver(),
  ownershipStore = new FakeOwnershipStore(),
  widgetAuthorization?: { uid: string; sessionId: string; sessionVersion: number } | null,
  widgetActionRevision = 0,
) {
  const coordinator = new LiveActivityCoordinator({
    source: source as never,
    ownershipStore,
    loadDriver: async () => driver,
    isIOS: true,
    now: () => new Date(2026, 9, 3, 12),
    scheduleMidnightRefresh: false,
    getWidgetAuthorization: () => widgetAuthorization ?? null,
    getWidgetActionRevision: () => widgetActionRevision,
  });
  coordinator.attach();
  return { coordinator, driver, ownershipStore };
}

describe('LiveActivityCoordinator', () => {
  let attachedCoordinators: LiveActivityCoordinator[];

  beforeEach(() => {
    attachedCoordinators = [];
  });

  afterEach(() => {
    attachedCoordinators.forEach((coordinator) => coordinator.detach());
  });

  it('starts automatically from a complete pending snapshot and ends at zero', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(
      snapshot('user-a', [delivery('pending', 2), delivery('already-delivered', 3, true)]),
    );
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

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
      completedDeliveryCount: 1,
      totalDeliveryCount: 2,
      isObsolete: false,
    });
    expect(ownershipStore.value?.deliveryIds).toEqual(['already-delivered', 'pending']);

    const completed = snapshot('user-a', [
      delivery('pending', 2, true),
      delivery('already-delivered', 3, true),
    ]);
    source.setSnapshot(completed);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: completed });

    expect(driver.instances[0]?.end).toHaveBeenCalledWith(
      'immediate',
      expect.objectContaining({
        bucketCount: 0,
        deliveryCount: 0,
        completedDeliveryCount: 2,
        totalDeliveryCount: 2,
      }),
      expect.any(Date),
    );
    expect(driver.instances[0]?.ended).toBe(true);
    expect(ownershipStore.value).toBeNull();
    expect(coordinator.getSnapshot().isActive).toBe(false);
  });

  it('starts again when a new pending delivery is added after completion', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot('user-a', []));
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);
    expect(driver.start).not.toHaveBeenCalled();

    const pending = snapshot('user-a', [delivery('new-delivery', 4)]);
    source.setSnapshot(pending);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: pending });

    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(driver.instances[0]?.content.deliveryCount).toBe(1);
  });

  it('updates an active instance from confirmed snapshots without changing its UID fence', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const authorization = {
      uid: 'user-a',
      sessionId: 'opaque-widget-session',
      sessionVersion: 4,
    };
    const { coordinator, driver } = makeCoordinator(
      source,
      new FakeDriver(),
      new FakeOwnershipStore(),
      authorization,
      7,
    );
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 4);

    const changed = snapshot('user-a', [delivery('one'), delivery('new', 5)]);
    source.setSnapshot(changed);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: changed });

    expect(driver.instances[0]?.content).toMatchObject({
      deliveryCount: 2,
      actionSessionId: 'opaque-widget-session',
      actionRevision: 7,
    });
    expect(JSON.stringify(driver.instances[0]?.content)).not.toContain('user-a');
  });

  it('does not attach widget authorization from another UID or session version', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot('user-a'));
    const { coordinator, driver } = makeCoordinator(
      source,
      new FakeDriver(),
      new FakeOwnershipStore(),
      { uid: 'user-b', sessionId: 'other-session', sessionVersion: 4 },
      9,
    );
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 4);

    expect(driver.instances[0]?.content).not.toHaveProperty('actionSessionId');
  });

  it('recovers an owned activity, refreshes it, and ends duplicates', async () => {
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
      deliveryIds: ['one'],
    };
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(driver.start).not.toHaveBeenCalled();
    expect(first.ended).toBe(false);
    expect(duplicate.ended).toBe(true);
    expect(first.content).toMatchObject({ bucketCount: 2, deliveryCount: 1, isObsolete: false });
  });

  it('serializes concurrent confirmed snapshots without duplicate starts', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot('user-a', []));
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);

    const pending = snapshot();
    source.setSnapshot(pending);
    await Promise.all([
      coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: pending }),
      coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: pending }),
    ]);

    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(driver.getInstances()).toHaveLength(1);
  });

  it('does not restart a system-dismissed activity until a new pending delivery is added', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);
    const dismissed = driver.instances[0];
    if (!dismissed) throw new Error('Expected an automatically started activity.');
    dismissed.ended = true;

    await (coordinator as unknown as { handleForeground: () => Promise<void> }).handleForeground();

    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(coordinator.getSnapshot().isActive).toBe(false);
    expect(ownershipStore.value).not.toBeNull();

    const withNewDelivery = snapshot('user-a', [delivery('one'), delivery('new-pending')]);
    source.setSnapshot(withNewDelivery);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: withNewDelivery });

    expect(driver.start).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot().isActive).toBe(true);
  });

  it('does not start without a complete current-day snapshot', async () => {
    const source = new FakeSnapshotSource();
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(driver.start).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().canStart).toBe(false);
  });

  it('does not duplicate an existing activity during foreground reconciliation', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);
    const active = driver.instances[0];
    if (!active) throw new Error('Expected an automatically started activity.');

    await (coordinator as unknown as { handleForeground: () => Promise<void> }).handleForeground();

    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(driver.getInstances()).toEqual([active]);
    expect(active.content.isObsolete).toBe(false);
    expect(coordinator.getSnapshot().isActive).toBe(true);
  });

  it('ends the prior UID activity before starting for a new authenticated session', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot('user-a'));
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);
    const previous = driver.instances[0];

    source.setSnapshot(snapshot('user-b', [delivery('other-user', 8)]));
    await coordinator.setSession('user-b', 2);

    expect(previous?.ended).toBe(true);
    expect(ownershipStore.value?.uid).toBe('user-b');
    expect(driver.start).toHaveBeenCalledTimes(2);
    expect(driver.instances[1]?.content.deliveryCount).toBe(1);
  });

  it('marks an active payload obsolete while the complete date is being revalidated', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);

    await coordinator.handleDateSnapshotEvent({ type: 'invalidated', uid: 'user-a', date: TODAY });
    expect(driver.instances[0]?.content.isObsolete).toBe(true);
    expect(coordinator.getSnapshot().canStart).toBe(false);

    await coordinator.handleDateSnapshotEvent({ type: 'refreshing', uid: 'user-a', date: TODAY });
    expect(driver.instances[0]?.content.isObsolete).toBe(true);
  });

  it('does not report an activity active when ActivityKit rejects an automatic start', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot('user-a', []));
    const { coordinator, driver } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);
    driver.start.mockImplementationOnce(() => {
      throw new Error('Live Activities disabled');
    });

    const pending = snapshot();
    source.setSnapshot(pending);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: pending });

    expect(coordinator.getSnapshot()).toMatchObject({ supported: true, isActive: false });
    expect(driver.start).toHaveBeenCalledTimes(1);
  });

  it('starts once after a transient ActivityKit recovery failure', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const driver = new FakeDriver();
    driver.getInstances.mockImplementationOnce(() => {
      throw new Error('ActivityKit unavailable');
    });
    const { coordinator } = makeCoordinator(source, driver);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(coordinator.getSnapshot().isActive).toBe(true);
    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(driver.getInstances()).toHaveLength(1);
  });

  it('retains the last good payload on update failure and retries a failed end', async () => {
    const source = new FakeSnapshotSource();
    source.setSnapshot(snapshot());
    const { coordinator, driver, ownershipStore } = makeCoordinator(source);
    attachedCoordinators.push(coordinator);
    await coordinator.setSession('user-a', 1);
    const active = driver.instances[0];
    if (!active) throw new Error('Expected an automatically started activity.');

    active.failUpdate = true;
    const changed = snapshot('user-a', [delivery('one', 8)]);
    source.setSnapshot(changed);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: changed });
    expect(active.content.bucketCount).toBe(2);
    expect(coordinator.getSnapshot().isActive).toBe(true);

    active.failUpdate = false;
    active.failEnd = true;
    const completed = snapshot('user-a', [delivery('one', 8, true)]);
    source.setSnapshot(completed);
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: completed });
    expect(active.ended).toBe(false);
    expect(active.content.deliveryCount).toBe(0);
    expect(ownershipStore.value?.content.deliveryCount).toBe(0);

    active.failEnd = false;
    await coordinator.handleDateSnapshotEvent({ type: 'complete', snapshot: completed });
    expect(active.ended).toBe(true);
    expect(ownershipStore.value).toBeNull();
  });

  it('keeps old counts marked obsolete if no complete snapshot is available after relaunch', async () => {
    const source = new FakeSnapshotSource();
    const driver = new FakeDriver();
    const recovered = driver.add('recovered', content({ bucketCount: 6 }));
    const ownershipStore = new FakeOwnershipStore();
    ownershipStore.value = {
      uid: 'user-a',
      activityId: 'recovered',
      content: recovered.content,
      deliveryIds: ['one'],
    };
    const { coordinator } = makeCoordinator(source, driver, ownershipStore);
    attachedCoordinators.push(coordinator);

    await coordinator.setSession('user-a', 1);

    expect(recovered.content).toMatchObject({ bucketCount: 6, isObsolete: true });
    expect(coordinator.getSnapshot()).toMatchObject({ isActive: true, canStart: false });
  });
});
