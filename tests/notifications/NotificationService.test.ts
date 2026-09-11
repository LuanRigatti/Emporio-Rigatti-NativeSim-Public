jest.mock('react-native', () => ({
  Linking: { openSettings: jest.fn().mockResolvedValue(undefined) },
  Platform: { OS: 'ios' },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: { projectId: 'project-1' }, expoConfig: null },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn().mockReturnValue(true),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addPushTokenListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExpoPushToken[test]' }),
  getLastNotificationResponse: jest.fn().mockReturnValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({
    canAskAgain: true,
    granted: true,
    status: 'granted',
  }),
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({
    canAskAgain: true,
    granted: true,
    status: 'granted',
  }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
}));

jest.mock('@/repositories', () => ({
  PushTokenRepository: jest.fn().mockImplementation(() => ({
    read: jest.fn().mockResolvedValue(undefined),
    replace: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as Notifications from 'expo-notifications';

import { notificationService } from '@/services/notifications';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps the native permission state to the application status', async () => {
    await expect(notificationService.getStatus('user-1')).resolves.toMatchObject({
      permission: 'granted',
      platform: 'ios',
      tokenRegistered: false,
    });
  });

  it('requests permission, registers the Expo token and enables the background task', async () => {
    await expect(notificationService.requestPermissionAndRegister('user-1')).resolves.toMatchObject(
      {
        permission: 'granted',
        platform: 'ios',
      },
    );

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(Notifications.registerTaskAsync).toHaveBeenCalledWith('pareact-notification-background');
  });

  it('returns a removable subscription for token renewal', () => {
    const subscription = notificationService.subscribeToTokenRenewal('user-1');

    expect(subscription.remove).toEqual(expect.any(Function));
    expect(Notifications.addPushTokenListener).toHaveBeenCalledTimes(1);
  });
});
