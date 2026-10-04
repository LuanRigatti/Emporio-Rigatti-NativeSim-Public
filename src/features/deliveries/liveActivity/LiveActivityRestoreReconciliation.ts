import {
  firestoreDeliveryDataSource,
  type FirestoreDeliveryDataSource,
} from '@/services/deliveries/FirestoreDeliveryDataSource';
import { todayIso } from '@/utils/data';

export async function reconcileLiveActivityAfterRestore(
  writesSucceeded: number,
  uid: string,
  sessionVersion: number,
  source: FirestoreDeliveryDataSource = firestoreDeliveryDataSource,
): Promise<void> {
  if (writesSucceeded <= 0) return;
  const date = todayIso();
  source.invalidateCompleteDateSnapshot(uid, date, sessionVersion);
  try {
    await source.load(uid, { mode: 'today', date }, { force: true }, sessionVersion);
  } catch {
    // Restore remains successful; only a complete query may refresh the activity snapshot.
  }
}
