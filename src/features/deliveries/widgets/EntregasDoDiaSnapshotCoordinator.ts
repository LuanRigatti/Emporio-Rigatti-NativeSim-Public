import * as Linking from 'expo-linking';
import type { WidgetTimelineEntry } from 'expo-widgets';
import { Platform } from 'react-native';

import {
  firestoreDeliveryDataSource,
  type CompleteDeliveryDateSnapshot,
  type DeliveryDateSnapshotEvent,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import { todayIso } from '@/utils/data';

import { getDeliveryWidgetActionsNative } from '@/services/deliveries/DeliveryWidgetActionsNative';
import {
  createEntregasDoDiaTimeline,
  projectEntregasDoDiaSnapshot,
  unavailableEntregasDoDiaWidgetProps,
  type EntregasDoDiaWidgetProps,
  type EntregasDoDiaWidgetTimelineProps,
} from './EntregasDoDiaSnapshot';

export type DeliverySnapshotSource = Pick<
  typeof firestoreDeliveryDataSource,
  'subscribeDateSnapshots' | 'getCompleteDateSnapshot'
> &
  Partial<Pick<typeof firestoreDeliveryDataSource, 'load'>>;

type DeliveryActionReceipt = {
  id: string;
  date: string;
  revision: number;
};

export type DeliveryActionStateStore = {
  authorizationMetadata: () => { uid: string; sessionId: string } | null;
  actionRevision: (sessionId: string, date: string) => number;
  pendingReceipts: (uid: string) => DeliveryActionReceipt[];
  acknowledgeReceipts: (identifiers: string[]) => void;
};

type DeliveryWidgetDriver = {
  updateTimeline: (entries: WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps>[]) => void;
  getTimeline?: () => Promise<WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps>[]>;
};

type CoordinatorDependencies = {
  source?: DeliverySnapshotSource;
  isIOS?: boolean;
  now?: () => Date;
  routeURL?: () => string;
  deliveryURL?: (deliveryId: string, date: string) => string;
  loadWidget?: () => Promise<DeliveryWidgetDriver>;
  actionStateStore?: DeliveryActionStateStore | null;
};

function isConfirmedActionEntry(
  value: unknown,
  expectedDate: string,
  expectedSessionId: string,
): value is WidgetTimelineEntry<EntregasDoDiaWidgetTimelineProps> {
  if (!value || typeof value !== 'object' || !('props' in value)) return false;
  const props = value.props;
  if (!props || typeof props !== 'object') return false;
  const candidate = props as Record<string, unknown>;
  const state = candidate.state;
  const count = candidate.deliveryCount;
  const rows = candidate.deliveries;
  if (
    candidate.date !== expectedDate ||
    candidate.actionSessionId !== expectedSessionId ||
    !Number.isSafeInteger(candidate.actionRevision) ||
    (candidate.actionRevision as number) < 0 ||
    !Number.isSafeInteger(count) ||
    (count as number) < 0 ||
    !Array.isArray(rows)
  ) {
    return false;
  }
  if (state === 'pending') {
    return (
      (count as number) > 0 &&
      rows.length === count &&
      rows.every((row) => {
        if (!row || typeof row !== 'object') return false;
        const fields = row as Record<string, unknown>;
        return (
          typeof fields.id === 'string' &&
          fields.id.length > 0 &&
          typeof fields.clientName === 'string' &&
          typeof fields.quantityLabel === 'string' &&
          typeof fields.valueLabel === 'string'
        );
      })
    );
  }
  return (state === 'all_completed' || state === 'empty') && count === 0 && rows.length === 0;
}

export class EntregasDoDiaSnapshotCoordinator {
  private readonly source: DeliverySnapshotSource;
  private readonly isIOS: boolean;
  private readonly now: () => Date;
  private readonly routeURL: () => string;
  private readonly deliveryURL: (deliveryId: string, date: string) => string;
  private readonly loadWidgetDriver: () => Promise<DeliveryWidgetDriver>;
  private readonly actionStateStore: DeliveryActionStateStore | null;
  private activeUid: string | null = null;
  private activeSessionVersion: number | undefined;
  private generation = 0;
  private currentDate: string;
  private currentSnapshot: EntregasDoDiaWidgetProps;
  private lastPublishedSnapshot: string | null = null;
  private widgetDriver: DeliveryWidgetDriver | null = null;
  private readonly reconcilingDates = new Set<string>();
  private readonly unsubscribeDateSnapshots: () => void;

  public constructor(dependencies: CoordinatorDependencies = {}) {
    this.source = dependencies.source ?? firestoreDeliveryDataSource;
    this.isIOS = dependencies.isIOS ?? Platform.OS === 'ios';
    this.now = dependencies.now ?? (() => new Date());
    this.routeURL = dependencies.routeURL ?? (() => Linking.createURL('/historico?mode=wholesale'));
    this.deliveryURL =
      dependencies.deliveryURL ??
      ((deliveryId, date) =>
        Linking.createURL(`/historico/entrega/${encodeURIComponent(deliveryId)}`, {
          queryParams: { date },
        }));
    this.loadWidgetDriver =
      dependencies.loadWidget ??
      (async () => {
        const { entregasDoDiaWidget } = await import('./EntregasDoDiaWidget');
        return entregasDoDiaWidget;
      });
    const nativeActions = getDeliveryWidgetActionsNative();
    this.actionStateStore =
      dependencies.actionStateStore ??
      (nativeActions
        ? {
            authorizationMetadata: () => nativeActions.deliveryWidgetAuthorizationMetadata(),
            actionRevision: (sessionId, date) =>
              nativeActions.deliveryWidgetActionRevision(sessionId, date),
            pendingReceipts: (uid) => nativeActions.pendingDeliveryWidgetActionReceipts(uid),
            acknowledgeReceipts: (identifiers) =>
              nativeActions.acknowledgeDeliveryWidgetActionReceipts(identifiers),
          }
        : null);
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
    const pendingCurrentDateReceipt = Boolean(
      normalizedUid &&
      this.widgetDriver?.getTimeline &&
      this.readActionReceipts(normalizedUid).some((receipt) => receipt.date === this.currentDate) &&
      this.hasAuthorizationFor(normalizedUid),
    );
    if (pendingCurrentDateReceipt && normalizedUid && this.widgetDriver) {
      const driver = this.widgetDriver;
      void this.restoreConfirmedActionTimeline(driver, normalizedUid, generation).then(
        (preserved) => {
          if (!preserved && generation === this.generation) this.publishTimeline();
        },
      );
    } else {
      this.publishTimeline();
    }
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

    const receipts = this.readActionReceipts(normalizedUid);
    if (receipts.length > 0) this.reconcileActionReceipts(normalizedUid, sessionVersion, receipts);
    if (receipts.some((receipt) => receipt.date === date)) return;

    const snapshot = this.source.getCompleteDateSnapshot(normalizedUid, date, sessionVersion);
    this.publishCompleteSnapshot(snapshot, normalizedUid, sessionVersion);
  }

  public dispose(): void {
    this.unsubscribeDateSnapshots();
  }

  private hasAuthorizationFor(uid: string): boolean {
    try {
      return this.actionStateStore?.authorizationMetadata()?.uid === uid;
    } catch {
      return false;
    }
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
    const receipts = this.readActionReceipts(uid).filter((receipt) => receipt.date === eventDate);
    if (receipts.length > 0) {
      this.reconcileActionReceipts(uid, sessionVersion, receipts);
      return;
    }

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
      this.publishSnapshot(
        projectEntregasDoDiaSnapshot(snapshot, this.routeURL(), (deliveryId, date) =>
          this.deliveryURL(deliveryId, date),
        ),
      );
    } catch {
      this.publishSnapshot(unavailableEntregasDoDiaWidgetProps(this.currentDate, this.routeURL()));
    }
  }

  private publishSnapshot(snapshot: EntregasDoDiaWidgetProps): void {
    const enrichedSnapshot: EntregasDoDiaWidgetProps = { ...snapshot };
    delete enrichedSnapshot.actionSessionId;
    delete enrichedSnapshot.actionRevision;
    try {
      const metadata = this.actionStateStore?.authorizationMetadata();
      if (metadata?.uid === this.activeUid && metadata.sessionId) {
        enrichedSnapshot.actionSessionId = metadata.sessionId;
        enrichedSnapshot.actionRevision = Math.max(
          0,
          this.actionStateStore?.actionRevision(metadata.sessionId, snapshot.date) ?? 0,
        );
      }
    } catch {
      // Interactive actions stay unavailable until the protected authorization is readable.
    }
    this.currentSnapshot = enrichedSnapshot;
    const signature = JSON.stringify(enrichedSnapshot);
    if (signature === this.lastPublishedSnapshot) return;
    this.lastPublishedSnapshot = signature;
    this.publishTimeline();
  }

  private readActionReceipts(uid: string): DeliveryActionReceipt[] {
    try {
      return (this.actionStateStore?.pendingReceipts(uid) ?? []).filter(
        (receipt) =>
          typeof receipt.id === 'string' &&
          receipt.id.length > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) &&
          Number.isSafeInteger(receipt.revision) &&
          receipt.revision >= 0,
      );
    } catch {
      return [];
    }
  }

  private reconcileActionReceipts(
    uid: string,
    sessionVersion: number | undefined,
    receipts: readonly DeliveryActionReceipt[],
  ): void {
    const loadSnapshot = this.source.load?.bind(this.source);
    if (!loadSnapshot || !this.actionStateStore) return;
    const receiptsByDate = new Map<string, DeliveryActionReceipt[]>();
    receipts.forEach((receipt) => {
      const dateReceipts = receiptsByDate.get(receipt.date) ?? [];
      dateReceipts.push(receipt);
      receiptsByDate.set(receipt.date, dateReceipts);
    });

    receiptsByDate.forEach((dateReceipts, date) => {
      const taskKey = `${uid}:${sessionVersion ?? 'none'}:${date}`;
      if (this.reconcilingDates.has(taskKey)) return;
      this.reconcilingDates.add(taskKey);
      const receiptIds = new Set(dateReceipts.map(({ id }) => id));
      let shouldReconcileNewerReceipts = false;

      void loadSnapshot(uid, { mode: 'today', date }, { force: true }, sessionVersion)
        .then(() => {
          if (uid !== this.activeUid || sessionVersion !== this.activeSessionVersion) return;
          const snapshot = this.source.getCompleteDateSnapshot(uid, date, sessionVersion);
          if (!snapshot || snapshot.uid !== uid || snapshot.date !== date) return;

          const currentReceipts = this.readActionReceipts(uid).filter(
            (receipt) => receipt.date === date,
          );
          this.actionStateStore?.acknowledgeReceipts(
            currentReceipts.filter(({ id }) => receiptIds.has(id)).map(({ id }) => id),
          );
          shouldReconcileNewerReceipts = currentReceipts.some(({ id }) => !receiptIds.has(id));

          if (
            date === this.currentDate &&
            this.readActionReceipts(uid).every((r) => r.date !== date)
          ) {
            this.publishCompleteSnapshot(snapshot, uid, sessionVersion);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          this.reconcilingDates.delete(taskKey);
          if (
            shouldReconcileNewerReceipts &&
            uid === this.activeUid &&
            sessionVersion === this.activeSessionVersion
          ) {
            this.reconcileActionReceipts(
              uid,
              sessionVersion,
              this.readActionReceipts(uid).filter((receipt) => receipt.date === date),
            );
          }
        });
    });
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

  private async restoreConfirmedActionTimeline(
    driver: DeliveryWidgetDriver,
    uid: string,
    generation: number,
  ): Promise<boolean> {
    if (!driver.getTimeline || !this.actionStateStore) return false;
    const date = this.currentDate;
    if (!this.readActionReceipts(uid).some((receipt) => receipt.date === date)) return false;

    let metadata: { uid: string; sessionId: string } | null;
    try {
      metadata = this.actionStateStore.authorizationMetadata();
    } catch {
      return false;
    }
    if (metadata?.uid !== uid || !metadata.sessionId) return false;

    try {
      const timeline = await driver.getTimeline();
      const stillPending = this.readActionReceipts(uid).some((receipt) => receipt.date === date);
      if (
        generation !== this.generation ||
        uid !== this.activeUid ||
        !stillPending ||
        metadata.sessionId !== this.actionStateStore.authorizationMetadata()?.sessionId
      ) {
        return false;
      }
      const entry = timeline.find((candidate) =>
        isConfirmedActionEntry(candidate, date, metadata.sessionId),
      );
      if (!entry) return false;
      this.currentSnapshot = { ...entry.props };
      this.lastPublishedSnapshot = JSON.stringify(this.currentSnapshot);
      return true;
    } catch {
      return false;
    }
  }

  private async loadWidget(generation: number): Promise<void> {
    if (!this.isIOS || this.widgetDriver) return;
    try {
      const driver = await this.loadWidgetDriver();
      if (generation !== this.generation) return;
      this.widgetDriver = driver;
      const uid = this.activeUid;
      const preservedActionTimeline = uid
        ? await this.restoreConfirmedActionTimeline(driver, uid, generation)
        : false;
      if (generation !== this.generation) return;
      if (!preservedActionTimeline) this.publishTimeline();
    } catch {
      // expo-widgets is an optional native module in Expo Go.
    }
  }
}

export const entregasDoDiaSnapshotCoordinator = new EntregasDoDiaSnapshotCoordinator();
