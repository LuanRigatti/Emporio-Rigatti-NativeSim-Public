import { getDatabase, type Database } from 'firebase/database';

import { getFirebaseApp } from './app';

let database: Database | undefined;

export function getFirebaseDatabase(): Database {
  if (!database) {
    database = getDatabase(getFirebaseApp());
  }

  return database;
}
