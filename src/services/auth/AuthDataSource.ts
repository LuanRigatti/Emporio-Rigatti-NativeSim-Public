import { ENABLE_FIREBASE_AUTH } from '@/config/featureFlags';

import { FirebaseAuthDataSource, firebaseAuthDataSource } from './FirebaseAuthDataSource';
import { MockAuthDataSource, mockAuthDataSource } from './MockAuthDataSource';
import type { AuthDataSource } from './types';

export const authDataSource: AuthDataSource = ENABLE_FIREBASE_AUTH
  ? firebaseAuthDataSource
  : mockAuthDataSource;

export { FirebaseAuthDataSource, MockAuthDataSource, firebaseAuthDataSource, mockAuthDataSource };
