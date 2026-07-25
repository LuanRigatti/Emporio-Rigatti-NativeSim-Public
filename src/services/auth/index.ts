import { FirebaseAuthService } from './FirebaseAuthService';

export { FirebaseAuthService } from './FirebaseAuthService';
export { AuthService, authService } from './AuthService';
export { AuthUserFacingError, mapAuthError } from './AuthErrorMapper';
export type { AuthErrorCode } from './AuthErrorMapper';
export type { AuthServiceContract, AuthStateListener, AuthUser } from './types';

export const firebaseAuthService = new FirebaseAuthService();
