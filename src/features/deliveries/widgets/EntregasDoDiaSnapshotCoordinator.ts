import * as Linking from 'expo-linking';
import type { WidgetTimelineEntry } from 'expo-widgets';
import { Platform } from 'react-native';

import {
  firestoreDeliveryDataSource,
  type CompleteDeliveryDateSnapshot,
  type DeliveryDateSnapshotEvent,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import { todayIso } from '@/utils/data';

import {
  createEntregasDoDiaTimeline,
  projectEntregasDoDiaSnapshot,
  unavailableEntregasDoDiaWidgetProps,
  type EntregasDoDiaWidgetProps,
  type EntregasDoDiaWidgetTimelineProps,
} from './EntregasDoDiaSnapshot';

type DeliverySnapshotSource = Pick<
  typeof firestoreDeliveryDataSource,
  'subscribeDateSnapshots' | 'getCompleteDateSnapshot'
>;

type DeliveryWidgetDriver = {
  updateTimeline: (entries: WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps>[]) => void;
};

type CoordinatorDependencies = {
  source?: DeliverySnapshotSource;
  isIOS?: boolean;
  now?: () => Date;
  routeURL?: () => string;
  loadWidget?: () => Promise<DeliveryWidgetDriver>;
};

export class EntregasDoDiaSnapshotCoordinator {
  private readonly source: DeliverySnapshotSource;
  private readonly isIOS: boolean;
  private readonly now: () => Date;
  private readonly routeURL: () => string;
  private readonly loadWidgetDriver: () => Promise<DeliveryWidgetDriver>;
  private activeUid: string | null = null;
  private activeSessionVersion: number | undefined;
  private generation = 0;
  private currentDate: string;
  private currentSnapshot: EntregasDoDiaWidgetProps;
  private lastPublishedSnapshot: string | null = null;
  private widgetDriver: DeliveryWidgetDriver | null = null;
  private readonly unsubscribeDateSnapshots: () => void;

  public constructor(dependencies: CoordinatorDependencies = {}) {
    this.source = dependencies.source ?? firestoreDeliveryDataSource;
    this.isIOS = dependencies.isIOS ?? Platform.OS === 'ios';
    this.now = dependencies.now ?? (() => new Date());
    this.routeURL = dependencies.routeURL ?? (() => Linking.createURL('/historico?mode=wholesale'));
    this.loadWidgetDriver =
      dependencies.loadWidget ??
      (async () => {
        const { entregasDoDiaWidget } = await import('./EntregasDoDiaWidget');
        return entregasDoDiaWidget;
      });
    this.currentDate = todayIso(this.now());
    this.currentSnapshot = unavailableEntregasDoDiaWidgetProps(this.currentDate);
    this.unsubscribeDateSnapshots = this.isIOS
      ? this.source.subscribeDateSnapshots((event) => this.handleDateSnapshotEvent(event))
      : () => undefined;
  }

  public setSession(uid: string | null, sessionVersion?: number): void {
    const normalizedUid = uid?.trim() || null;
    if (normalizedUid === this.activeUid && sessionVersion === this.activeSessionVersion) {
      this.refreshAvailableSnapshot(normalizedUid, sessionVersion);
      return;
    }

    this.activeUid = normalizedUid;
    this.activeSessionVersion = sessionVersion;
    const generation = ++this.generation;
    this.currentDate = todayIso(this.now());
    this.currentSnapshot = unavailableEntregasDoDiaWidgetProps(
      this.currentDate,
      normalizedUid ? this.routeURL() : undefined,
    );
    this.lastPublishedSnapshot = null;
    this.publishTimeline();
    void this.loadWidget(generation);

    if (normalizedUid) this.refreshAvailableSnapshot(normalizedUid, sessionVersion);
  }

  /** Reads only a fresh complete snapshot already held by the canonical data source. */
  public refreshAvailableSnapshot(uid: string | null, sessionVersion?: number): void {
    const normalizedUid = uid?.trim() || null;
    if (normalizedUid !== this.activeUid || sessionVersion !== this.activeSessionVersion) return;

    const date = todayIso(this.now());
    if (date !== this.currentDate) {
      this.currentDate = date;
      this.currentSnapshot = unavailableEntregasDoDiaWidgetProps(
        date,
        normalizedUid ? this.routeURL() : undefined,
      );
      this.lastPublishedSnapshot = null;
    }

    if (!normalizedUid) {
      this.publishSnapshot(unavailableEntregasDoDiaWidgetProps(date));
      return;
    }

    const snapshot = this.source.getCompleteDateSnapshot(normalizedUid, date, sessionVersion);
    this.publishCompleteSnapshot(snapshot, normalizedUid, sessionVersion);
  }

  public dispose(): void {
    this.unsubscribeDateSnapshots();
  }

  private handleDateSnapshotEvent(event: DeliveryDateSnapshotEvent): void {
    const today = todayIso(this.now());
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.currentSnapshot = unavailableEntregasDoDiaWidgetProps(
        today,
        this.activeUid ? this.routeURL() : undefined,
      );
      this.lastPublishedSnapshot = null;
    }
    const eventUid = event.type === 'complete' ? event.snapshot.uid : event.uid;
    const eventDate = event.type === 'complete' ? event.snapshot.date : event.date;
    const uid = this.activeUid;
    const sessionVersion = this.activeSessionVersion;
    if (!uid || eventUid !== uid || eventDate !== today) return;

    if (event.type === 'invalidated') {
      this.publishSnapshot(unavailableEntregasDoDiaWidgetProps(eventDate, this.routeURL()));
      return;
    }

    const snapshot = this.source.getCompleteDateSnapshot(uid, eventDate, sessionVersion);
    this.publishCompleteSnapshot(snapshot, uid, sessionVersion);
  }

  private publishCompleteSnapshot(
    snapshot: CompleteDeliveryDateSnapshot | null,
    uid: string,
    sessionVersion?: number,
  ): void {
    if (uid !== this.activeUid || sessionVersion !== this.activeSessionVersion) return;
    if (!snapshot || snapshot.uid !== uid || snapshot.date !== this.currentDate) {
      this.publishSnapshot(unavailableEntregasDoDiaWidgetProps(this.currentDate, this.routeURL()));
      return;
    }

    try {
      this.publishSnapshot(projectEntregasDoDiaSnapshot(snapshot, this.routeURL()));
    } catch {
      this.publishSnapshot(unavailableEntregasDoDiaWidgetProps(this.currentDate, this.routeURL()));
    }
  }

  private publishSnapshot(snapshot: EntregasDoDiaWidgetProps): void {
    this.currentSnapshot = snapshot;
    const signature = JSON.stringify(snapshot);
    if (signature === this.lastPublishedSnapshot) return;
    this.lastPublishedSnapshot = signature;
    this.publishTimeline();
  }

  private publishTimeline(): void {
    if (!this.isIOS || !this.widgetDriver) return;
    const routeURL = this.currentSnapshot.deliveryRouteURL;
    const entries = createEntregasDoDiaTimeline(this.currentSnapshot, this.now(), routeURL);
    try {
      this.widgetDriver.updateTimeline(entries);
    } catch {
      // Widget publishing is best-effort; a later source event or foreground refresh retries it.
      this.lastPublishedSnapshot = null;
    }
  }

  private async loadWidget(generation: number): Promise<void> {
    if (!this.isIOS || this.widgetDriver) return;
    try {
      const driver = await this.loadWidgetDriver();
      if (generation !== this.generation) return;
      this.widgetDriver = driver;
      this.publishTimeline();
    } catch {
      // expo-widgets is an optional native module in Expo Go.
    }
  }
}

export const entregasDoDiaSnapshotCoordinator = new EntregasDoDiaSnapshotCoordinator();
