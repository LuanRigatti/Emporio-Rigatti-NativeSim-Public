import { AppState, Platform } from 'react-native';

import {
  type CompleteDeliveryDateSnapshot,
  type DeliveryDateSnapshotEvent,
  firestoreDeliveryDataSource,
  type FirestoreDeliveryDataSource,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
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

export type LiveActivityActionResult = { ok: true } | { ok: false; message: string };

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
};

const UNSUPPORTED_MESSAGE = 'A Atividade ao vivo está disponível somente na versão iOS instalada.';
const INCOMPLETE_MESSAGE =
  'Aguarde o carregamento completo das entregas de hoje e tente novamente.';
const ACTION_ERROR_MESSAGE = 'Não foi possível atualizar a Atividade ao vivo. Tente novamente.';

export class LiveActivityCoordinator {
  private readonly source: FirestoreDeliveryDataSource;
  private readonly ownershipStore: LiveActivityOwnershipStore;
  private readonly loadDriver: () => Promise<LiveActivityDriver | null>;
  private readonly isIOS: boolean;
  private readonly now: () => Date;
  private readonly shouldScheduleMidnightRefresh: boolean;
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

        if (event.type === 'invalidated') {
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
        if (this.activeInstance && this.ownership?.uid === session.uid) {
          await this.publishFreshSnapshot(snapshot, session.uid);
        }
      });
    } catch {
      this.updateState({
        isActive: Boolean(this.activeInstance),
        canStart: Boolean(this.getCurrentCompleteSnapshot()),
      });
    }
  }

  public async toggleFromToolbar(): Promise<LiveActivityActionResult> {
    const session = this.session;
    if (!this.isIOS || this.state.supported !== true) {
      return { ok: false, message: UNSUPPORTED_MESSAGE };
    }
    if (!session?.uid) return { ok: false, message: UNSUPPORTED_MESSAGE };
    const uid = session.uid;

    this.updateState({ isBusy: true });
    try {
      return await this.enqueue(async () => {
        if (!this.isCurrentSession(session)) {
          return { ok: false, message: ACTION_ERROR_MESSAGE };
        }
        try {
          const driver = await this.getDriver();
          if (!driver) return { ok: false, message: UNSUPPORTED_MESSAGE };

          const wasActiveWhenOperationStarted = Boolean(this.activeInstance || this.state.isActive);
          const existing = await this.recoverActivity(driver, uid, driver.getInstances());
          const action = wasActiveWhenOperationStarted ? 'stop' : existing ? 'refresh' : 'start';
          if (action === 'stop') {
            return await this.stopAllInstances(driver);
          }

          const date = todayIso(this.now());
          const snapshot = this.source.getCompleteDateSnapshot(uid, date, session.sessionVersion);
          if (!snapshot) {
            this.updateState({ isActive: Boolean(existing), canStart: false });
            return { ok: false, message: INCOMPLETE_MESSAGE };
          }

          if (action === 'refresh' && existing) {
            this.updateState({ isActive: true, canStart: true });
            await this.publishFreshSnapshot(snapshot, uid);
            return { ok: true };
          }

          const content: LiveActivityContent = {
            ...projectWholesaleDeliverySnapshot(snapshot),
            isObsolete: false,
          };
          const activity = driver.start(
            content,
            '/historico?mode=wholesale',
            nextLocalMidnight(content.date),
          );
          const ownership = { uid, activityId: activity.getId(), content };
          try {
            await this.ownershipStore.write(ownership);
          } catch {
            await activity.end('immediate').catch(() => undefined);
            this.activeInstance = null;
            this.ownership = null;
            this.updateState({ isActive: false, canStart: true });
            return { ok: false, message: ACTION_ERROR_MESSAGE };
          }
          this.activeInstance = activity;
          this.ownership = ownership;
          this.updateState({ isActive: true, canStart: true });
          return { ok: true };
        } catch {
          this.updateState({ canStart: Boolean(this.getCurrentCompleteSnapshot()) });
          return { ok: false, message: ACTION_ERROR_MESSAGE };
        }
      });
    } finally {
      this.updateState({ isBusy: false });
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
      this.ownership = null;
      if (storedOwnership) await this.clearOwnershipSafely();
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
  ): Promise<void> {
    const instance = this.activeInstance;
    const existingOwnership = this.ownership;
    if (!instance || !existingOwnership || existingOwnership.uid !== uid) return;

    const content: LiveActivityContent = {
      ...projectWholesaleDeliverySnapshot(snapshot),
      isObsolete: false,
    };
    if (this.sameContent(existingOwnership.content, content)) return;

    const nextOwnership: LiveActivityOwnership = {
      uid,
      activityId: instance.getId(),
      content,
    };
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

  private async stopAllInstances(driver: LiveActivityDriver): Promise<LiveActivityActionResult> {
    const instances = driver.getInstances();
    const candidates = new Map<string, LiveActivityInstance>();
    instances.forEach((instance) => candidates.set(instance.getId(), instance));
    if (this.activeInstance) candidates.set(this.activeInstance.getId(), this.activeInstance);
    const results = await Promise.allSettled(
      [...candidates.values()].map((instance) => instance.end('immediate')),
    );
    const failed = results.some((result) => result.status === 'rejected');
    if (failed) {
      this.updateState({ isActive: true, canStart: false });
      return { ok: false, message: ACTION_ERROR_MESSAGE };
    }

    this.activeInstance = null;
    this.ownership = null;
    this.updateState({
      isActive: false,
      canStart: Boolean(this.getCurrentCompleteSnapshot()),
    });
    try {
      await this.ownershipStore.clear();
    } catch {
      return { ok: false, message: ACTION_ERROR_MESSAGE };
    }
    return { ok: true };
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
      left.isObsolete === right.isObsolete
    );
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
