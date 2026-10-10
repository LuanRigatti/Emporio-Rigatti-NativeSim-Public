import { requireOptionalNativeModule } from 'expo-modules-core';
import type { WidgetTimelineEntry } from 'expo-widgets';

import type { ResumoFinanceiroWidgetProps } from './ResumoFinanceiroSnapshot';

type PublishStage = 'update_timeline' | 'widget_module_load';

type NativeWidgetDiagnosticsModule = {
  publishStart(
    entryCount: number,
    wholesaleRevenueAvailable: boolean,
    wholesaleProfitAvailable: boolean,
    retailRevenueAvailable: boolean,
    retailProfitAvailable: boolean,
  ): void;
  publishResult(success: boolean, stage: PublishStage): void;
  timelineRead(success: boolean, entryCount: number, validEntryCount: number): void;
};

const nativeDiagnostics =
  requireOptionalNativeModule<NativeWidgetDiagnosticsModule>('NativeWidgetDiagnostics');

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMetricShape(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isFinanceDomainShape(value: unknown): boolean {
  return isRecord(value) && isMetricShape(value.faturamento) && isMetricShape(value.lucroLiquido);
}

function isWidgetPropsShape(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    typeof value.monthKey === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value.monthKey) &&
    typeof value.monthLabel === 'string' &&
    isFinanceDomainShape(value.wholesale) &&
    isFinanceDomainShape(value.retail)
  );
}

export function summarizeFinanceWidgetTimeline(entries: unknown): {
  entryCount: number;
  validEntryCount: number;
} {
  const timeline = Array.isArray(entries) ? entries : [];
  const validEntryCount = timeline.filter((entry) => {
    if (!isRecord(entry) || !(entry.date instanceof Date)) return false;
    if (!Number.isFinite(entry.date.getTime())) return false;
    return isWidgetPropsShape(entry.props);
  }).length;

  return { entryCount: timeline.length, validEntryCount };
}

function hasAvailableMetric(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function safelyLog(action: (module: NativeWidgetDiagnosticsModule) => void): void {
  try {
    if (nativeDiagnostics) action(nativeDiagnostics);
  } catch {
    // Diagnostics must not affect widget publication or app behavior.
  }
}

export function recordFinanceWidgetPublishStart(
  entries: WidgetTimelineEntry<ResumoFinanceiroWidgetProps>[],
): void {
  const props = entries[0]?.props;
  safelyLog((module) =>
    module.publishStart(
      entries.length,
      hasAvailableMetric(props?.wholesale?.faturamento),
      hasAvailableMetric(props?.wholesale?.lucroLiquido),
      hasAvailableMetric(props?.retail?.faturamento),
      hasAvailableMetric(props?.retail?.lucroLiquido),
    ),
  );
}

export function recordFinanceWidgetPublishResult(success: boolean, stage: PublishStage): void {
  safelyLog((module) => module.publishResult(success, stage));
}

export function recordFinanceWidgetTimelineRead(success: boolean, entries: unknown): void {
  const summary = summarizeFinanceWidgetTimeline(entries);
  safelyLog((module) => module.timelineRead(success, summary.entryCount, summary.validEntryCount));
}
