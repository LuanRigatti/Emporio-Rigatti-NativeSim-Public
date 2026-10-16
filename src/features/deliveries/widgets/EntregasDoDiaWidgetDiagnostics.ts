import { requireOptionalNativeModule } from 'expo';

export type DeliveryWidgetSnapshotState = 'pending' | 'all_completed' | 'empty' | 'unavailable';
export type DeliveryWidgetDiagnosticEvent =
  | 'snapshot_refresh_started'
  | 'snapshot_invalidated'
  | 'snapshot_query_published'
  | 'snapshot_mutation_published'
  | 'snapshot_unavailable'
  | 'timeline_publish_started'
  | 'timeline_publish_succeeded'
  | 'timeline_publish_failed';
type WidgetRuntimeEvent =
  | 'coordinator_started'
  | 'module_loaded'
  | 'module_load_failed'
  | 'timeline_publish_succeeded'
  | 'timeline_publish_failed';

type NativeDeliveryWidgetDiagnosticsModule = {
  deliverySnapshotEvent(
    event: DeliveryWidgetDiagnosticEvent,
    state: DeliveryWidgetSnapshotState,
    deliveryCount: number,
    success: boolean,
  ): void;
  widgetRuntimeEvent(
    widgetName: 'EntregasDoDia',
    event: WidgetRuntimeEvent,
    success: boolean,
  ): void;
};

const nativeDiagnostics =
  requireOptionalNativeModule<NativeDeliveryWidgetDiagnosticsModule>('NativeWidgetDiagnostics');

export function logDeliveryWidgetSnapshotDiagnostic(
  event: DeliveryWidgetDiagnosticEvent,
  state: DeliveryWidgetSnapshotState,
  deliveryCount: number,
  success: boolean,
): void {
  if (!nativeDiagnostics) return;
  const safeCount = Number.isFinite(deliveryCount)
    ? Math.max(0, Math.min(1000, Math.trunc(deliveryCount)))
    : 0;
  try {
    nativeDiagnostics.deliverySnapshotEvent(event, state, safeCount, success);
  } catch {
    // Diagnostics are best-effort and must never affect snapshot publication.
  }
}

export function logEntregasWidgetRuntimeEvent(event: WidgetRuntimeEvent, success: boolean): void {
  if (!nativeDiagnostics) return;
  try {
    nativeDiagnostics.widgetRuntimeEvent('EntregasDoDia', event, success);
  } catch {
    // Runtime state readback is best-effort and must not affect delivery snapshots.
  }
}
