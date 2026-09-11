import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { getFirebaseConfig } from '@/config';

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (app) {
    return app;
  }

  app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  return app;
}
