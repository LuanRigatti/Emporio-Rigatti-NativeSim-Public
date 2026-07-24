import { FirebaseAuthService } from './FirebaseAuthService';

export { FirebaseAuthService } from './FirebaseAuthService';
export type { AuthService, AuthStateListener, AuthUser } from './types';

export const authService = new FirebaseAuthService();
