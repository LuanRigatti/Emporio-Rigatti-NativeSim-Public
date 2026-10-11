import { requireOptionalNativeModule } from 'expo-modules-core';
import type { WidgetTimelineEntry } from 'expo-widgets';

import type { ResumoFinanceiroWidgetTimelineProps } from './ResumoFinanceiroSnapshot';

type PublishStage = 'update_timeline' | 'widget_module_load';

export type FinanceWidgetPublishErrorMetadata = {
  errorType: string | null;
  errorDomain: string | null;
  errorCode: string | null;
};

const SAFE_ERROR_TYPE = /^[A-Z][A-Za-z0-9]{0,63}$/;
const SAFE_ERROR_CODE = /^ERR_[A-Z0-9_]{1,60}$/;
const SAFE_ERROR_DOMAINS = new Set([
  'EXErrorDomain',
  'ExpoModulesCore',
  'NSCocoaErrorDomain',
  'NSOSStatusErrorDomain',
  'NSPOSIXErrorDomain',
  'WidgetKit',
]);
const UPDATED_TIMELINE_WITHOUT_LAYOUT = 'ERR_UPDATED_TIMELINE_WITHOUT_LAYOUT';

type NativeWidgetDiagnosticsModule = {
  publishStart(
    entryCount: number,
    wholesaleRevenueAvailable: boolean,
    wholesaleProfitAvailable: boolean,
    retailRevenueAvailable: boolean,
    retailProfitAvailable: boolean,
  ): void;
  publishResult(
    success: boolean,
    stage: PublishStage,
    errorType: string | null,
    errorDomain: string | null,
    errorCode: string | null,
  ): void;
  timelineRead(success: boolean, entryCount: number, validEntryCount: number): void;
};

const nativeDiagnostics =
  requireOptionalNativeModule<NativeWidgetDiagnosticsModule>('NativeWidgetDiagnostics');

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFinanceDomainShape(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const isOptionalString = (key: 'faturamento' | 'lucroLiquido'): boolean =>
    !Object.prototype.hasOwnProperty.call(value, key) || typeof value[key] === 'string';

  return isOptionalString('faturamento') && isOptionalString('lucroLiquido');
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

function readErrorProperty(error: unknown, property: 'name' | 'domain' | 'code'): unknown {
  if ((typeof error !== 'object' && typeof error !== 'function') || error === null)
    return undefined;

  try {
    return (error as Record<string, unknown>)[property];
  } catch {
    return undefined;
  }
}

function sanitizeErrorType(value: unknown): string | null {
  return typeof value === 'string' && SAFE_ERROR_TYPE.test(value) ? value : null;
}

function sanitizeErrorDomain(value: unknown): string | null {
  return typeof value === 'string' && SAFE_ERROR_DOMAINS.has(value) ? value : null;
}

function sanitizeErrorCode(value: unknown): string | null {
  if (typeof value === 'string') return SAFE_ERROR_CODE.test(value) ? value : null;
  if (typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 999_999) {
    return String(value);
  }
  return null;
}

export function extractFinanceWidgetPublishErrorMetadata(
  error: unknown,
): FinanceWidgetPublishErrorMetadata {
  const errorCode = sanitizeErrorCode(readErrorProperty(error, 'code'));
  const errorType = sanitizeErrorType(readErrorProperty(error, 'name'));
  const isUpdatedTimelineWithoutLayout =
    errorType === 'UpdatedTimelineWithoutLayout' || errorCode === UPDATED_TIMELINE_WITHOUT_LAYOUT;

  return {
    errorType: isUpdatedTimelineWithoutLayout ? 'UpdatedTimelineWithoutLayout' : errorType,
    errorDomain: sanitizeErrorDomain(readErrorProperty(error, 'domain')),
    errorCode,
  };
}

function safelyLog(action: (module: NativeWidgetDiagnosticsModule) => void): void {
  try {
    if (nativeDiagnostics) action(nativeDiagnostics);
  } catch {
    // Diagnostics must not affect widget publication or app behavior.
  }
}

export function recordFinanceWidgetPublishStart(
  entries: WidgetTimelineEntry<ResumoFinanceiroWidgetTimelineProps>[],
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

export function recordFinanceWidgetPublishResult(
  success: boolean,
  stage: PublishStage,
  error?: unknown,
): void {
  const metadata =
    !success && stage === 'update_timeline'
      ? extractFinanceWidgetPublishErrorMetadata(error)
      : { errorType: null, errorDomain: null, errorCode: null };
  safelyLog((module) =>
    module.publishResult(
      success,
      stage,
      metadata.errorType,
      metadata.errorDomain,
      metadata.errorCode,
    ),
  );
}

export function recordFinanceWidgetTimelineRead(success: boolean, entries: unknown): void {
  const summary = summarizeFinanceWidgetTimeline(entries);
  safelyLog((module) => module.timelineRead(success, summary.entryCount, summary.validEntryCount));
}
