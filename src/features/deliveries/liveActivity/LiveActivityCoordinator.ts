import { AppState, Platform } from 'react-native';

import {
  type CompleteDeliveryDateSnapshot,
  type DeliveryDateSnapshotEvent,
  firestoreDeliveryDataSource,
  type FirestoreDeliveryDataSource,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import { getDeliveryWidgetActionsNative } from '@/services/deliveries/DeliveryWidgetActionsNative';
import { todayIso } from '@/utils/data';

import type {
  LiveActivityContent,
  LiveActivityDriver,
  LiveActivityInstance,
  LiveActivityOwnership,
  LiveActivityOwnershipStore,
} from './LiveActivityContracts';
import { liveActivityOwnershipStore } from './LiveActivityOwnershipStore';
import { nextLocalMidnight, projectWholesaleDeliverySnapshot } from './LiveActivityProjection';

export type LiveActivityCoordinatorState = {
  supported: boolean | null;
  isActive: boolean;
  isBusy: boolean;
  canStart: boolean;
};

type Session = {
  uid: string | null;
  sessionVersion: number;
  sequence: number;
};

type CoordinatorDependencies = {
  source?: FirestoreDeliveryDataSource;
  ownershipStore?: LiveActivityOwnershipStore;
  loadDriver?: () => Promise<LiveActivityDriver | null>;
  isIOS?: boolean;
  now?: () => Date;
  scheduleMidnightRefresh?: boolean;
  getWidgetAuthorization?: () => {
    uid: string;
    sessionId: string;
    sessionVersion: number;
  } | null;
  getWidgetActionRevision?: (sessionId: string, date: string) => number;
};

export class LiveActivityCoordinator {
  private readonly source: FirestoreDeliveryDataSource;
  private readonly ownershipStore: LiveActivityOwnershipStore;
  private readonly loadDriver: () => Promise<LiveActivityDriver | null>;
  private readonly isIOS: boolean;
  private readonly now: () => Date;
  private readonly shouldScheduleMidnightRefresh: boolean;
  private readonly getWidgetAuthorization: NonNullable<
    CoordinatorDependencies['getWidgetAuthorization']
  >;
  private readonly getWidgetActionRevision: NonNullable<
    CoordinatorDependencies['getWidgetActionRevision']
  >;
  private readonly listeners = new Set<() => void>();
  private state: LiveActivityCoordinatorState = {
    supported: null,
    isActive: false,
    isBusy: false,
    canStart: false,
  };
  private session: Session | null = null;
  private sequence = 0;
  private driverPromise: Promise<LiveActivityDriver | null> | null = null;
  private driver: LiveActivityDriver | null = null;
  private activeInstance: LiveActivityInstance | null = null;
  private ownership: LiveActivityOwnership | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private unsubscribeSnapshots: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private midnightTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(dependencies: CoordinatorDependencies = {}) {
    this.source = dependencies.source ?? firestoreDeliveryDataSource;
    this.ownershipStore = dependencies.ownershipStore ?? liveActivityOwnershipStore;
    this.loadDriver =
      dependencies.loadDriver ??
      (async () => {
        const adapter = await import('./ExpoWidgetsLiveActivityAdapter');
        return adapter.createWholesaleDeliveryLiveActivityDriver();
      });
    this.isIOS = dependencies.isIOS ?? Platform.OS === 'ios';
    this.now = dependencies.now ?? (() => new Date());
    this.shouldScheduleMidnightRefresh = dependencies.scheduleMidnightRefresh ?? true;
    const nativeActions = getDeliveryWidgetActionsNative();
    this.getWidgetAuthorization =
      dependencies.getWidgetAuthorization ??
      (() => nativeActions?.deliveryWidgetAuthorizationMetadata() ?? null);
    this.getWidgetActionRevision =
      dependencies.getWidgetActionRevision ??
      ((sessionId, date) => nativeActions?.deliveryWidgetActionRevision(sessionId, date) ?? 0);
  }

  public getSnapshot = (): LiveActivityCoordinatorState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public attach(): () => void {
    if (!this.unsubscribeSnapshots) {
      this.unsubscribeSnapshots = this.source.subscribeDateSnapshots((event) => {
        void this.handleDateSnapshotEvent(event).catch(() => undefined);
      });
    }
    if (this.isIOS && !this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') void this.handleForeground();
      });
    }
    return () => this.detach();
  }

  public detach(): void {
    this.unsubscribeSnapshots?.();
    this.unsubscribeSnapshots = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
    this.midnightTimer = null;
  }

  public async setSession(uid: string | null, sessionVersion: number): Promise<void> {
    const previousSession = this.session;
    const session: Session = { uid, sessionVersion, sequence: ++this.sequence };
    this.session = session;
    this.updateState({ isBusy: true, canStart: false });
    this.scheduleNextMidnight();

    await this.enqueue(async () => {
      if (!this.isCurrentSession(session)) return;
      try {
        const driver = await this.getDriver();
        if (!this.isCurrentSession(session)) return;
        if (!driver) {
          this.activeInstance = null;
          this.ownership = null;
          this.updateState({
            supported: false,
            isActive: false,
            isBusy: false,
            canStart: false,
          });
          return;
        }

        this.updateState({ supported: true });
        const instances = driver.getInstances();
        const changedUid = Boolean(previousSession?.uid && previousSession.uid !== uid);
        if (!uid || changedUid) {
          if (instances.length > 0) this.updateState({ isActive: true, canStart: false });
          await this.endInstances(instances);
          this.activeInstance = null;
          this.ownership = null;
          if (instances.length === 0 || driver.getInstances().length === 0) {
            await this.clearOwnershipSafely();
            this.updateState({ isActive: false, canStart: false, isBusy: false });
          } else {
            this.updateState({ isActive: true, canStart: false, isBusy: false });
          }
          return;
        }

        const recovered = await this.recoverActivity(driver, uid, instances);
        if (!this.isCurrentSession(session)) return;
        this.updateState({
          isActive: Boolean(recovered),
          canStart: Boolean(
            this.source.getCompleteDateSnapshot(uid, todayIso(this.now()), sessionVersion),
          ),
          isBusy: false,
        });
      } catch {
        this.updateState({
          isBusy: false,
          canStart: false,
          isActive: this.state.isActive || Boolean(this.activeInstance),
        });
        this.setSupportedError();
      }
    });

    if (!uid || !this.isCurrentSession(session) || this.state.supported !== true) return;
    if (this.activeInstance) {
      await this.enqueue(async () => this.markObsoleteInternal());
    }
    await this.reconcileCurrentDate(session);
    await this.flushQueue();
  }

  public async reconcileCurrentDate(session = this.session): Promise<boolean> {
    if (!session?.uid || !this.isCurrentSession(session) || this.state.supported === false) {
      return false;
    }
    const date = todayIso(this.now());
    try {
      await this.source.load(session.uid, { mode: 'today', date }, {}, session.sessionVersion);
    } catch {
      if (this.isCurrentSession(session)) {
        this.updateState({ canStart: false });
        await this.enqueue(async () => this.markObsoleteInternal());
      }
      return false;
    }
    const complete = this.source.getCompleteDateSnapshot(session.uid, date, session.sessionVersion);
    if (!complete && this.isCurrentSession(session)) this.updateState({ canStart: false });
    await this.flushQueue();
    return Boolean(complete);
  }

  public async handleDateSnapshotEvent(event: DeliveryDateSnapshotEvent): Promise<void> {
    try {
      await this.enqueue(async () => {
        const session = this.session;
        const eventUid = event.type === 'complete' ? event.snapshot.uid : event.uid;
        if (!session?.uid || eventUid !== session.uid || !this.isCurrentSession(session)) return;
        const today = todayIso(this.now());
        const eventDate = event.type === 'complete' ? event.snapshot.date : event.date;
        if (eventDate !== today) return;

        if (event.type === 'refreshing' || event.type === 'invalidated') {
          this.updateState({ canStart: false });
          await this.markObsoleteInternal();
          return;
        }

        const snapshot = this.source.getCompleteDateSnapshot(
          session.uid,
          event.snapshot.date,
          session.sessionVersion,
        );
        if (!snapshot) {
          this.updateState({ canStart: false });
          return;
        }
        this.updateState({ canStart: true });
        await this.reconcileConfirmedSnapshot(snapshot, session);
      });
    } catch {
      this.updateState({
        isActive: Boolean(this.activeInstance),
        canStart: Boolean(this.getCurrentCompleteSnapshot()),
      });
    }
  }

  private async handleForeground(): Promise<void> {
    const session = this.session;
    if (!session?.uid || !this.isCurrentSession(session)) return;
    this.scheduleNextMidnight();
    if (this.state.isActive || this.activeInstance) {
      if (!this.state.isActive) this.updateState({ isActive: true });
    } else {
      this.updateState({ canStart: false });
    }
    await this.enqueue(async () => {
      if (!this.isCurrentSession(session)) return;
      try {
        const driver = await this.getDriver();
        if (!driver) {
          this.updateState({ supported: false, isActive: false, canStart: false });
          return;
        }
        const recovered = await this.recoverActivity(
          driver,
          session.uid as string,
          driver.getInstances(),
        );
        if (!this.isCurrentSession(session)) return;
        this.updateState({ isActive: Boolean(recovered), canStart: false });
        if (recovered) await this.markObsoleteInternal();
      } catch {
        this.updateState({
          isActive: this.state.isActive || Boolean(this.activeInstance),
          canStart: false,
        });
        await this.markObsoleteInternal();
      }
    });
    if (!this.isCurrentSession(session) || this.state.supported !== true) return;
    await this.reconcileCurrentDate(session);
  }

  private async handleMidnight(): Promise<void> {
    this.midnightTimer = null;
    const session = this.session;
    if (!session?.uid || !this.isCurrentSession(session)) return;
    this.updateState({ canStart: false });
    if (AppState.currentState === 'active') {
      if (this.activeInstance) {
        await this.enqueue(async () => this.markObsoleteInternal());
      }
      await this.reconcileCurrentDate(session);
    }
    this.scheduleNextMidnight();
  }

  private scheduleNextMidnight(): void {
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
    this.midnightTimer = null;
    if (!this.shouldScheduleMidnightRefresh || !this.session?.uid) return;
    const now = this.now();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.midnightTimer = setTimeout(
      () => void this.handleMidnight(),
      Math.max(1, next.getTime() - now.getTime()),
    );
  }

  private async getDriver(): Promise<LiveActivityDriver | null> {
    if (!this.isIOS) return null;
    if (!this.driverPromise) {
      this.driverPromise = this.loadDriver()
        .then((driver) => {
          this.driver = driver;
          this.updateState({ supported: driver !== null });
          return driver;
        })
        .catch(() => {
          this.driver = null;
          this.updateState({ supported: false });
          return null;
        });
    }
    return this.driverPromise;
  }

  private async reconcileConfirmedSnapshot(
    snapshot: CompleteDeliveryDateSnapshot,
    session: Session,
  ): Promise<void> {
    if (!session.uid || !this.isCurrentSession(session) || snapshot.uid !== session.uid) return;
    const driver = await this.getDriver();
    if (!driver || !this.isCurrentSession(session)) return;

    const active = await this.recoverActivity(driver, session.uid, driver.getInstances());
    if (!this.isCurrentSession(session)) return;

    const projection = projectWholesaleDeliverySnapshot(snapshot);
    if (active) {
      if (projection.deliveryCount === 0) {
        await this.endForConfirmedSnapshot(active, snapshot, session);
      } else {
        this.updateState({ isActive: true, canStart: true });
        await this.publishFreshSnapshot(snapshot, session.uid, session.sessionVersion);
      }
      return;
    }

    if (projection.deliveryCount === 0) {
      this.activeInstance = null;
      this.ownership = null;
      await this.clearOwnershipSafely();
      this.updateState({ isActive: false, canStart: true });
      return;
    }

    const previousOwnership = this.ownership;
    const mayStart =
      !previousOwnership ||
      previousOwnership.uid !== session.uid ||
      previousOwnership.content.date !== snapshot.date ||
      this.hasNewPendingDelivery(snapshot, previousOwnership);
    if (!mayStart) {
      if (!previousOwnership.deliveryIds) {
        const migratedOwnership = {
          ...previousOwnership,
          deliveryIds: this.deliveryIds(snapshot),
        };
        this.ownership = migratedOwnership;
        await this.ownershipStore.write(migratedOwnership).catch(() => undefined);
      }
      // ActivityKit no longer exposes a system-dismissed activity through getInstances().
      // Keep ownership as a same-day tombstone so foreground reconciliation won't recreate it.
      this.updateState({ isActive: false, canStart: true });
      return;
    }

    if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
      this.updateState({ isActive: false, canStart: true });
      return;
    }

    await this.startForSnapshot(driver, snapshot, session);
  }

  private async startForSnapshot(
    driver: LiveActivityDriver,
    snapshot: CompleteDeliveryDateSnapshot,
    session: Session,
  ): Promise<void> {
    if (!session.uid || !this.isCurrentSession(session)) return;
    const content = this.createContent(snapshot, session.uid, session.sessionVersion);
    try {
      const activity = driver.start(
        content,
        '/historico?mode=wholesale',
        nextLocalMidnight(content.date),
      );
      const ownership: LiveActivityOwnership = {
        uid: session.uid,
        activityId: activity.getId(),
        content,
        deliveryIds: this.deliveryIds(snapshot),
      };
      try {
        await this.ownershipStore.write(ownership);
      } catch {
        await activity.end('immediate').catch(() => undefined);
        return;
      }
      if (!this.isCurrentSession(session)) {
        await activity.end('immediate').catch(() => undefined);
        await this.clearOwnershipSafely();
        return;
      }
      this.activeInstance = activity;
      this.ownership = ownership;
      this.updateState({ isActive: true, canStart: true });
    } catch {
      // ActivityKit enforces the user's Live Activities authorization at start time.
      this.updateState({ isActive: false, canStart: true });
    }
  }

  private async endForConfirmedSnapshot(
    instance: LiveActivityInstance,
    snapshot: CompleteDeliveryDateSnapshot,
    session: Session,
  ): Promise<void> {
    if (!session.uid || !this.isCurrentSession(session)) return;
    const content = this.createContent(snapshot, session.uid, session.sessionVersion);
    try {
      await instance.end('immediate', content, this.now());
      this.activeInstance = null;
      this.ownership = null;
      this.updateState({ isActive: false, canStart: true });
      await this.clearOwnershipSafely();
    } catch {
      try {
        await instance.update(content, nextLocalMidnight(content.date));
        const ownership: LiveActivityOwnership = {
          uid: session.uid,
          activityId: instance.getId(),
          content,
          deliveryIds: this.deliveryIds(snapshot),
        };
        this.activeInstance = instance;
        this.ownership = ownership;
        await this.ownershipStore.write(ownership);
      } catch {
        // Keep the last ownership state and retry on the next confirmed snapshot.
      }
      this.updateState({ isActive: true, canStart: true });
    }
  }

  private hasNewPendingDelivery(
    snapshot: CompleteDeliveryDateSnapshot,
    ownership: LiveActivityOwnership,
  ): boolean {
    if (!ownership.deliveryIds) return false;
    const knownIds = new Set(ownership.deliveryIds);
    return snapshot.deliveries.some((delivery) => !delivery.entregue && !knownIds.has(delivery.id));
  }

  private deliveryIds(snapshot: CompleteDeliveryDateSnapshot): string[] {
    return snapshot.deliveries.map((delivery) => delivery.id).sort();
  }

  private async recoverActivity(
    driver: LiveActivityDriver,
    uid: string,
    instances: LiveActivityInstance[],
  ): Promise<LiveActivityInstance | null> {
    let storedOwnership: LiveActivityOwnership | null = null;
    try {
      storedOwnership = await this.ownershipStore.read();
    } catch {
      storedOwnership = null;
    }

    if (instances.length === 0) {
      this.activeInstance = null;
      this.ownership = storedOwnership?.uid === uid ? storedOwnership : null;
      if (storedOwnership && storedOwnership.uid !== uid) await this.clearOwnershipSafely();
      return null;
    }

    const known =
      storedOwnership?.uid === uid
        ? instances.find((instance) => instance.getId() === storedOwnership.activityId)
        : undefined;
    if (!known) {
      this.updateState({ isActive: true, canStart: false });
      await this.endInstances(instances);
      const stillActive = driver.getInstances();
      if (stillActive.length === 0) {
        this.activeInstance = null;
        this.ownership = null;
        await this.clearOwnershipSafely();
        return null;
      }
      this.activeInstance = stillActive[0] ?? null;
      this.ownership = storedOwnership;
      this.updateState({ isActive: true, canStart: false });
      return this.activeInstance;
    }

    this.activeInstance = known;
    this.ownership = storedOwnership;
    const duplicates = instances.filter((instance) => instance.getId() !== known.getId());
    await this.endInstances(duplicates);
    return known;
  }

  private async publishFreshSnapshot(
    snapshot: CompleteDeliveryDateSnapshot,
    uid: string,
    sessionVersion: number,
  ): Promise<void> {
    const instance = this.activeInstance;
    const existingOwnership = this.ownership;
    if (!instance || !existingOwnership || existingOwnership.uid !== uid) return;

    const content = this.createContent(snapshot, uid, sessionVersion);
    const deliveryIds = this.deliveryIds(snapshot);
    const nextOwnership: LiveActivityOwnership = {
      uid,
      activityId: instance.getId(),
      content,
      deliveryIds,
    };
    const sameDeliveryIds =
      existingOwnership.deliveryIds?.length === deliveryIds.length &&
      existingOwnership.deliveryIds.every((id, index) => id === deliveryIds[index]);
    if (this.sameContent(existingOwnership.content, content)) {
      if (!sameDeliveryIds) {
        this.ownership = nextOwnership;
        await this.ownershipStore.write(nextOwnership);
      }
      return;
    }

    await instance.update(content, nextLocalMidnight(content.date));
    this.ownership = nextOwnership;
    await this.ownershipStore.write(nextOwnership);
  }

  private async markObsoleteInternal(): Promise<void> {
    const instance = this.activeInstance;
    const existingOwnership = this.ownership;
    if (!instance || !existingOwnership || existingOwnership.content.isObsolete) return;
    const content = { ...existingOwnership.content, isObsolete: true };
    const nextOwnership = { ...existingOwnership, content };
    try {
      await instance.update(content, nextLocalMidnight(content.date));
      this.ownership = nextOwnership;
      await this.ownershipStore.write(nextOwnership);
    } catch {
      this.updateState({ isActive: true });
    }
  }

  private async endInstances(instances: LiveActivityInstance[]): Promise<void> {
    await Promise.allSettled(instances.map((instance) => instance.end('immediate')));
  }

  private async clearOwnershipSafely(): Promise<void> {
    try {
      await this.ownershipStore.clear();
    } catch {
      // A later relaunch will retry cleanup when it finds no matching activity instance.
    }
  }

  private getCurrentCompleteSnapshot(): CompleteDeliveryDateSnapshot | null {
    const session = this.session;
    if (!session?.uid) return null;
    return this.source.getCompleteDateSnapshot(
      session.uid,
      todayIso(this.now()),
      session.sessionVersion,
    );
  }

  private isCurrentSession(session: Session): boolean {
    return this.session?.sequence === session.sequence;
  }

  private sameContent(left: LiveActivityContent, right: LiveActivityContent): boolean {
    return (
      left.date === right.date &&
      left.bucketCount === right.bucketCount &&
      left.deliveryCount === right.deliveryCount &&
      left.completedDeliveryCount === right.completedDeliveryCount &&
      left.totalDeliveryCount === right.totalDeliveryCount &&
      left.isObsolete === right.isObsolete &&
      left.actionSessionId === right.actionSessionId &&
      left.actionRevision === right.actionRevision
    );
  }

  private createContent(
    snapshot: CompleteDeliveryDateSnapshot,
    uid: string,
    sessionVersion: number,
  ): LiveActivityContent {
    const content: LiveActivityContent = {
      ...projectWholesaleDeliverySnapshot(snapshot),
      isObsolete: false,
    };
    try {
      const authorization = this.getWidgetAuthorization();
      if (
        authorization?.uid === uid &&
        authorization.sessionVersion === sessionVersion &&
        authorization.sessionId.trim().length > 0
      ) {
        content.actionSessionId = authorization.sessionId;
        content.actionRevision = Math.max(
          0,
          this.getWidgetActionRevision(authorization.sessionId, snapshot.date),
        );
      }
    } catch {
      // The activity remains available, but widget actions cannot target it without a valid session.
    }
    return content;
  }

  private setSupportedError(): void {
    if (this.state.supported === null) this.updateState({ supported: false });
  }

  private updateState(patch: Partial<LiveActivityCoordinatorState>): void {
    const next = { ...this.state, ...patch };
    if (
      next.supported === this.state.supported &&
      next.isActive === this.state.isActive &&
      next.isBusy === this.state.isBusy &&
      next.canStart === this.state.canStart
    ) {
      return;
    }
    this.state = next;
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // UI listeners cannot affect persisted delivery operations.
      }
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => undefined).then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async flushQueue(): Promise<void> {
    while (true) {
      const current = this.queue;
      await current.catch(() => undefined);
      if (current === this.queue) return;
    }
  }
}

export const wholesaleDeliveryLiveActivityCoordinator = new LiveActivityCoordinator();
