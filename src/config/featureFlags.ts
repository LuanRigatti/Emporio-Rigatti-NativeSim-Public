/**
 * Biometric unlock is prepared but intentionally disabled until the login flow
 * is explicitly migrated to use it.
 */
export const ENABLE_BIOMETRIC_UNLOCK = false;

/**
 * ProgressiveBlur remains unmounted until its Home integration is explicitly
 * enabled and validated in the SDK 57 Development Build.
 */
export const ENABLE_PROGRESSIVE_BLUR = false;

/**
 * The two-sheet native Registro flow is prepared but remains disabled while
 * the current production flow is kept as the default.
 */
export const ENABLE_NATIVE_SEQUENTIAL_REGISTRO_SHEET = false;
