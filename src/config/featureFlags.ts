/**
 * Biometric unlock is prepared but intentionally disabled until the login flow
 * is explicitly migrated to use it.
 */
export const ENABLE_BIOMETRIC_UNLOCK = false;

/**
 * Enables the prepared ProgressiveBlur layer on the Home screen.
 */
export const ENABLE_PROGRESSIVE_BLUR = true;

/**
 * Enables the two-sheet native Registro flow using the official SDK 57
 * BottomSheet presentation callbacks.
 */
export const ENABLE_NATIVE_SEQUENTIAL_REGISTRO_SHEET = true;

/**
 * Keeps the Clientes screen on its existing fictitious development data until
 * Firebase Auth and the definitive client database are connected.
 */
export const ENABLE_MOCK_CLIENT_DATA = true;
