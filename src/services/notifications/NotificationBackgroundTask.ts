import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const NOTIFICATION_BACKGROUND_TASK = 'pareact-notification-background';

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(NOTIFICATION_BACKGROUND_TASK)) {
  TaskManager.defineTask<unknown>(NOTIFICATION_BACKGROUND_TASK, async ({ error }) => {
    if (error) return;
  });
}
