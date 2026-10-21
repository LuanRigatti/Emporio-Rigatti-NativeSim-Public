import { AppState, Platform } from 'react-native';

import type { RouteTrackingRecord } from '@/types/routeTracking';
import {
  routeTrackingRepository,
  type RouteTrackingSessionContext,
} from '@/services/routes/RouteTrackingRepository';
import { formatRouteTrackingKilometers } from './RouteTrackingLiveActivityPresentation';

import type {
  RouteTrackingLiveActivityContent,
  RouteTrackingLiveActivityDriver,
  RouteTrackingLiveActivityInstance,
  RouteTrackingLiveActivityOwnership,
  RouteTrackingLiveActivityOwnershipStore,
  RouteTrackingLiveActivityRoute,
} from './RouteTrackingLiveActivityContracts';
import { routeTrackingLiveActivityOwnershipStore } from './RouteTrackingLiveActivityOwnershipStore';

const LOCATION_DEEP_LINK = '/configuracoes/localizacao';

type CoordinatorDependencies = {
  isIOS?: boolean;
  loadDriver?: () => Promise<RouteTrackingLiveActivityDriver | null>;
  ownershipStore?: RouteTrackingLiveActivityOwnershipStore;
};

type AuthSession = {
  sessionVersion: number;
  uid: string | null;
};

function toContent(route: RouteTrackingLiveActivityRoute): RouteTrackingLiveActivityContent {
  return {
    distanceMeters: route.accumulatedDistanceMeters,
    endTimestamp: route.endTimestamp,
    routeId: route.routeId,
    startTimestamp: route.startTimestamp,
  };
}

function hasValidDistance(route: RouteTrackingLiveActivityRoute): boolean {
  return Number.isFinite(route.accumulatedDistanceMeters) && route.accumulatedDistanceMeters >= 0;
}

export class RouteTrackingLiveActivityCoordinator {
  private readonly isIOS: boolean;
  private readonly loadDriver: () => Promise<RouteTrackingLiveActivityDriver | null>;
  private readonly ownershipStore: RouteTrackingLiveActivityOwnershipStore;
  private session: AuthSession | null = null;
  private sessionStateKnown = false;
  private driver: RouteTrackingLiveActivityDriver | null = null;
  private driverPromise: Promise<RouteTrackingLiveActivityDriver | null> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private appStateSubscription: { remove: () => void } | null = null;

  public constructor(dependencies: CoordinatorDependencies = {}) {
    this.isIOS = dependencies.isIOS ?? Platform.OS === 'ios';
    this.ownershipStore = dependencies.ownershipStore ?? routeTrackingLiveActivityOwnershipStore;
    this.loadDriver =
      dependencies.loadDriver ??
      (async () => {
        const adapter = await import('./RouteTrackingLiveActivityAdapter');
        return adapter.createRouteTrackingLiveActivityDriver();
      });
  }

  public attach(): () => void {
    if (this.isIOS && !this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') void this.reconcileCurrentSession();
      });
    }
    return () => {
      this.appStateSubscription?.remove();
      this.appStateSubscription = null;
    };
  }

  public async setSession(uid: string | null, sessionVersion: number): Promise<void> {
    this.sessionStateKnown = true;
    this.session = { sessionVersion, uid: uid?.trim() || null };
    if (!this.isIOS) return;

    await this.enqueueSafely(async () => {
      const driver = await this.getDriver();
      if (!driver) return;

      if (!this.session?.uid) {
        const ended = await this.endInstances(driver.getInstances());
        if (ended) await this.ownershipStore.clear();
        return;
      }

      const session = routeTrackingRepository.getSessionContext();
      if (!this.matchesSession(session, this.session)) return;
      const activeRoute = await routeTrackingRepository.getActiveRoute(session);
      if (!this.isCurrentSession(session)) return;
      await this.reconcileRoute(driver, activeRoute, session);
    });
  }

  public async startForRoute(
    route: RouteTrackingRecord,
    session: RouteTrackingSessionContext,
  ): Promise<void> {
    if (!this.isIOS || !route.active || !route.ownerUid || !hasValidDistance(route)) return;

    await this.enqueueSafely(async () => {
      if (!this.isCurrentSession(session)) return;
      if (this.sessionStateKnown && this.session?.uid !== session.uid) return;

      const driver = await this.getDriver();
      if (!driver || !this.isCurrentSession(session)) return;
      const instances = driver.getInstances();
      const ownership = await this.ownershipStore.read();
      if (!this.isCurrentSession(session)) return;

      if (
        ownership?.uid === session.uid &&
        ownership.routeId === route.routeId &&
        ownership.startTimestamp === route.startTimestamp
      ) {
        const instance = instances.find((candidate) => candidate.getId() === ownership.activityId);
        if (instance) await this.updateInstance(instance, route, ownership);
        return;
      }

      if (ownership) {
        const ownedInstance = instances.find(
          (candidate) => candidate.getId() === ownership.activityId,
        );
        if (ownedInstance) await ownedInstance.end('immediate');
        await this.ownershipStore.clear();
      }

      const remainingInstances = driver.getInstances();
      if (!(await this.endInstances(remainingInstances))) return;
      await this.startActivity(driver, route, session.uid);
    });
  }

  public async updateFromBackground(
    route: RouteTrackingLiveActivityRoute,
    session: RouteTrackingSessionContext | null,
  ): Promise<void> {
    if (!this.isIOS || !route.active || !route.ownerUid || !hasValidDistance(route)) return;

    await this.enqueueSafely(async () => {
      if (session && !this.isCurrentSession(session)) return;
      if (session && session.uid !== route.ownerUid) return;
      if (this.sessionStateKnown && this.session?.uid !== route.ownerUid) return;

      const ownership = await this.ownershipStore.read();
      if (
        !ownership ||
        ownership.uid !== route.ownerUid ||
        ownership.routeId !== route.routeId ||
        ownership.startTimestamp !== route.startTimestamp ||
        route.accumulatedDistanceMeters <= ownership.lastPublishedDistanceMeters ||
        formatRouteTrackingKilometers(route.accumulatedDistanceMeters) ===
          formatRouteTrackingKilometers(ownership.lastPublishedDistanceMeters)
      ) {
        return;
      }

      const driver = await this.getDriver();
      if (!driver) return;
      const instance = driver
        .getInstances()
        .find((candidate) => candidate.getId() === ownership.activityId);
      if (!instance) return;

      await this.updateInstance(instance, route, ownership);
    });
  }

  public async endForRoute(
    route: RouteTrackingRecord,
    session: RouteTrackingSessionContext,
  ): Promise<void> {
    if (!this.isIOS || !route.ownerUid || route.active || !hasValidDistance(route)) return;

    await this.enqueueSafely(async () => {
      if (!this.isCurrentSession(session) || route.ownerUid !== session.uid) return;

      const ownership = await this.ownershipStore.read();
      if (
        !ownership ||
        ownership.uid !== session.uid ||
        ownership.routeId !== route.routeId ||
        ownership.startTimestamp !== route.startTimestamp
      ) {
        return;
      }

      const driver = await this.getDriver();
      if (!driver) return;
      const instance = driver
        .getInstances()
        .find((candidate) => candidate.getId() === ownership.activityId);
      if (instance) {
        await instance.end(
          'immediate',
          toContent(route),
          new Date(route.endTimestamp ?? Date.now()),
        );
      }
      await this.ownershipStore.clear();
    });
  }

  private async reconcileCurrentSession(): Promise<void> {
    if (!this.isIOS || !this.sessionStateKnown) return;
    const sessionState = this.session;

    await this.enqueueSafely(async () => {
      const driver = await this.getDriver();
      if (!driver || this.session !== sessionState) return;
      if (!sessionState?.uid) {
        const ended = await this.endInstances(driver.getInstances());
        if (ended) await this.ownershipStore.clear();
        return;
      }

      const session = routeTrackingRepository.getSessionContext();
      if (!this.matchesSession(session, sessionState)) return;
      const activeRoute = await routeTrackingRepository.getActiveRoute(session);
      if (!this.isCurrentSession(session) || this.session !== sessionState) return;
      await this.reconcileRoute(driver, activeRoute, session);
    });
  }

  private async reconcileRoute(
    driver: RouteTrackingLiveActivityDriver,
    activeRoute: RouteTrackingRecord | null,
    session: RouteTrackingSessionContext,
  ): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    const instances = driver.getInstances();

    if (!activeRoute || activeRoute.ownerUid !== session.uid || !hasValidDistance(activeRoute)) {
      const ended = await this.endInstances(instances);
      if (ended) await this.ownershipStore.clear();
      return;
    }

    const ownership = await this.ownershipStore.read();
    if (!this.isCurrentSession(session)) return;
    if (
      ownership?.uid === session.uid &&
      ownership.routeId === activeRoute.routeId &&
      ownership.startTimestamp === activeRoute.startTimestamp
    ) {
      const instance = instances.find((candidate) => candidate.getId() === ownership.activityId);
      if (instance) await this.updateInstance(instance, activeRoute, ownership);
      // A missing owned instance may have been dismissed by the person or the system.
      // Keep its ownership as a tombstone and do not recreate it for this route.
      return;
    }

    if (ownership) {
      const ownedInstance = instances.find(
        (candidate) => candidate.getId() === ownership.activityId,
      );
      if (ownedInstance) await ownedInstance.end('immediate');
      await this.ownershipStore.clear();
    }

    if (!(await this.endInstances(driver.getInstances()))) return;
    await this.startActivity(driver, activeRoute, session.uid);
  }

  private async startActivity(
    driver: RouteTrackingLiveActivityDriver,
    route: RouteTrackingRecord,
    uid: string,
  ): Promise<void> {
    const instance = driver.start(toContent(route), LOCATION_DEEP_LINK);
    try {
      await this.ownershipStore.write({
        activityId: instance.getId(),
        lastPublishedDistanceMeters: route.accumulatedDistanceMeters,
        routeId: route.routeId,
        startTimestamp: route.startTimestamp,
        uid,
      });
    } catch (error) {
      await instance.end('immediate').catch(() => undefined);
      throw error;
    }
  }

  private async updateInstance(
    instance: RouteTrackingLiveActivityInstance,
    route: RouteTrackingLiveActivityRoute,
    ownership: RouteTrackingLiveActivityOwnership,
  ): Promise<void> {
    if (
      formatRouteTrackingKilometers(route.accumulatedDistanceMeters) ===
      formatRouteTrackingKilometers(ownership.lastPublishedDistanceMeters)
    ) {
      return;
    }
    await instance.update(toContent(route));
    await this.ownershipStore.write({
      ...ownership,
      lastPublishedDistanceMeters: route.accumulatedDistanceMeters,
    });
  }

  private async endInstances(instances: RouteTrackingLiveActivityInstance[]): Promise<boolean> {
    const results = await Promise.allSettled(
      instances.map((instance) => instance.end('immediate')),
    );
    return results.every((result) => result.status === 'fulfilled');
  }

  private async getDriver(): Promise<RouteTrackingLiveActivityDriver | null> {
    if (!this.isIOS) return null;
    if (this.driver) return this.driver;
    if (!this.driverPromise) this.driverPromise = this.loadDriver();
    try {
      this.driver = await this.driverPromise;
      return this.driver;
    } finally {
      this.driverPromise = null;
    }
  }

  private isCurrentSession(session: RouteTrackingSessionContext): boolean {
    return routeTrackingRepository.isSessionCurrent(session);
  }

  private matchesSession(
    context: RouteTrackingSessionContext | null,
    expected: AuthSession,
  ): context is RouteTrackingSessionContext {
    return Boolean(
      context &&
      expected.uid &&
      context.uid === expected.uid &&
      context.sessionVersion === expected.sessionVersion,
    );
  }

  private enqueueSafely(work: () => Promise<void>): Promise<void> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => undefined);
    return next.catch((error: unknown) => {
      console.warn('[RouteTracking] Live Activity GPS não pôde ser sincronizada.', error);
    });
  }
}

export const routeTrackingLiveActivityCoordinator = new RouteTrackingLiveActivityCoordinator();
