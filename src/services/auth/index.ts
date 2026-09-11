import { FirebaseAuthService } from './FirebaseAuthService';

export { FirebaseAuthService } from './FirebaseAuthService';
export { AuthService, authService } from './AuthService';
export { AuthUserFacingError, mapAuthError } from './AuthErrorMapper';
export type { AuthErrorCode } from './AuthErrorMapper';
export {
  FirebaseAuthDataSource,
  MockAuthDataSource,
  authDataSource,
  firebaseAuthDataSource,
  mockAuthDataSource,
} from './AuthDataSource';
export { MOCK_AUTH_SESSION_STORAGE_KEY } from './MockAuthDataSource';
export type { AuthDataSource, AuthServiceContract, AuthStateListener, AuthUser } from './types';

export const firebaseAuthService = new FirebaseAuthService();
