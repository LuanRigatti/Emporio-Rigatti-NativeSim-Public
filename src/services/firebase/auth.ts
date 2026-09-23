import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
  type ReactNativeAsyncStorage,
} from 'firebase/auth';

import {
  recordAuthDiagnosticEvent,
  sanitizeAuthDiagnosticCode,
} from '@/services/auth/AuthDiagnostic';

import { getFirebaseApp } from './app';

// Firebase's React Native export is selected by Metro, but is not declared by
// the facade's TypeScript entrypoint in the current SDK package.
const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence: (storage: ReactNativeAsyncStorage) => Persistence;
  }
).getReactNativePersistence;

let auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (auth) {
    return auth;
  }

  const app = getFirebaseApp();

  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    recordAuthDiagnosticEvent('auth:init:persistent');
  } catch (error) {
    // Fast Refresh can re-run this module after Auth was already initialized.
    recordAuthDiagnosticEvent('auth:init:fallback-getAuth', sanitizeAuthDiagnosticCode(error));
    auth = getAuth(app);
  }

  return auth;
}
