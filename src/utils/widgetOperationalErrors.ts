import { requireOptionalNativeModule } from 'expo';

type WidgetOperationalFailure =
  | 'delivery_timeline_publish_failed'
  | 'delivery_widget_module_load_failed'
  | 'finance_timeline_publish_failed'
  | 'finance_widget_module_load_failed';
type WidgetOperationalFailureStage = 'update_timeline' | 'widget_module_load';

type NativeWidgetOperationalErrorsModule = {
  recordFailure(
    event: WidgetOperationalFailure,
    stage: WidgetOperationalFailureStage,
    errorType: string | null,
    errorDomain: string | null,
    errorCode: string | null,
  ): void;
};

const nativeLogger = requireOptionalNativeModule<NativeWidgetOperationalErrorsModule>(
  'NativeWidgetOperationalErrors',
);
const SAFE_ERROR_TYPE = /^[A-Z][A-Za-z0-9]{0,63}$/;
const SAFE_ERROR_CODE = /^(ERR_[A-Z0-9_]{1,60}|-?[0-9]{1,6})$/;
const SAFE_ERROR_DOMAINS = new Set([
  'EXErrorDomain',
  'ExpoModulesCore',
  'NSCocoaErrorDomain',
  'NSOSStatusErrorDomain',
  'NSPOSIXErrorDomain',
  'WidgetKit',
]);

function readErrorProperty(error: unknown, property: 'name' | 'domain' | 'code'): unknown {
  if ((typeof error !== 'object' && typeof error !== 'function') || error === null) {
    return undefined;
  }

  try {
    return (error as Record<string, unknown>)[property];
  } catch {
    return undefined;
  }
}

function safeErrorType(error: unknown): string | null {
  const value = readErrorProperty(error, 'name');
  return typeof value === 'string' && SAFE_ERROR_TYPE.test(value) ? value : null;
}

function safeErrorDomain(error: unknown): string | null {
  const value = readErrorProperty(error, 'domain');
  return typeof value === 'string' && SAFE_ERROR_DOMAINS.has(value) ? value : null;
}

function safeErrorCode(error: unknown): string | null {
  const value = readErrorProperty(error, 'code');
  const normalized =
    typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof normalized === 'string' && SAFE_ERROR_CODE.test(normalized) ? normalized : null;
}

export function recordWidgetOperationalFailure(
  event: WidgetOperationalFailure,
  stage: WidgetOperationalFailureStage,
  error?: unknown,
): void {
  try {
    nativeLogger?.recordFailure(
      event,
      stage,
      safeErrorType(error),
      safeErrorDomain(error),
      safeErrorCode(error),
    );
  } catch {
    // Operational logging must never interrupt widget state updates.
  }
}
