import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { PushTokenRepository } from '@/repositories';
import type {
  AppNotificationEvent,
  NotificationKind,
  NotificationPermissionState,
  NotificationPlatform,
  NotificationStatus,
} from '@/types';

import { NOTIFICATION_BACKGROUND_TASK } from './NotificationBackgroundTask';

type NotificationUrlListener = (url: string) => void;
type NotificationEventListener = (event: AppNotificationEvent) => void;

type PermissionResponseShape = {
  canAskAgain?: boolean;
  granted?: boolean;
  status?: string;
};

export interface NotificationSubscription {
  remove: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function platform(): NotificationPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

function normalizeKind(value: unknown): NotificationKind {
  if (value === 'new_delivery' || value === 'collection_reminder' || value === 'test') {
    return value;
  }
  return 'test';
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const url = value.trim();
  if (
    url.startsWith('pareact://') ||
    url.startsWith('/') ||
    url.startsWith('https://venda-e-faturamento.web.app')
  ) {
    return url;
  }
  return undefined;
}

function eventFromNotification(notification: Notifications.Notification): AppNotificationEvent {
  const data: unknown = notification.request.content.data;
  const record = isRecord(data) ? data : {};
  return {
    body: notification.request.content.body ?? '',
    kind: normalizeKind(record.kind),
    title: notification.request.content.title ?? 'Notificação',
    url: safeUrl(record.url),
  };
}

function permissionState(
  status: Notifications.NotificationPermissionsStatus,
): NotificationPermissionState {
  const response = status as Notifications.NotificationPermissionsStatus & PermissionResponseShape;
  if (Platform.OS === 'web') return 'unsupported';
  if (
    Platform.OS === 'ios' &&
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return 'provisional';
  }
  if (response.granted || response.status === 'granted') return 'granted';
  if (response.status === 'denied') return 'denied';
  return 'undetermined';
}

function projectId(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

export class NotificationService {
  public configure(): void {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  public async getStatus(uid?: string): Promise<NotificationStatus> {
    const tokenRegistered = uid ? Boolean(await new PushTokenRepository(uid).read()) : false;
    if (Platform.OS === 'web') {
      return {
        canAskAgain: false,
        permission: 'unsupported',
        platform: 'web',
        tokenRegistered,
      };
    }

    const permissions = await Notifications.getPermissionsAsync();
    const response = permissions as Notifications.NotificationPermissionsStatus &
      PermissionResponseShape;
    return {
      canAskAgain: response.canAskAgain ?? false,
      permission: permissionState(permissions),
      platform: platform(),
      tokenRegistered,
    };
  }

  public async requestPermissionAndRegister(uid: string): Promise<NotificationStatus> {
    if (Platform.OS === 'web') {
      throw new Error('Notificações Expo não estão disponíveis no Expo Web.');
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: 'Notificações do aplicativo',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const currentResponse = current as Notifications.NotificationPermissionsStatus &
      PermissionResponseShape;
    const permissions =
      currentResponse.status === 'granted'
        ? current
        : await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });
    const state = permissionState(permissions);
    if (state !== 'granted' && state !== 'provisional') {
      throw new Error('A permissão de notificações foi negada. Ative-a nos ajustes do sistema.');
    }

    await this.registerExpoToken(uid);
    try {
      await Notifications.registerTaskAsync(NOTIFICATION_BACKGROUND_TASK);
    } catch {
      // A entrega visível continua sendo tratada pelo sistema operacional.
    }
    return this.getStatus(uid);
  }

  public async registerExpoToken(uid: string): Promise<string> {
    if (Platform.OS === 'web') {
      throw new Error('O token Expo não está disponível no Web.');
    }
    const easProjectId = projectId();
    if (!easProjectId) {
      throw new Error('Configure EXPO_PUBLIC_EXPO_PROJECT_ID ou o projectId do EAS.');
    }
    const token = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
    await new PushTokenRepository(uid).replace(token.data);
    return token.data;
  }

  public subscribeToTokenRenewal(
    uid: string,
    onError?: (error: unknown) => void,
  ): NotificationSubscription {
    if (Platform.OS === 'web') return { remove: () => undefined };
    const subscription = Notifications.addPushTokenListener(() => {
      void this.registerExpoToken(uid).catch((error: unknown) => onError?.(error));
    });
    return { remove: () => subscription.remove() };
  }

  public subscribeToForeground(listener: NotificationEventListener): NotificationSubscription {
    if (Platform.OS === 'web') return { remove: () => undefined };
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      listener(eventFromNotification(notification));
    });
    return { remove: () => subscription.remove() };
  }

  public subscribeToResponse(listener: NotificationUrlListener): NotificationSubscription {
    if (Platform.OS === 'web') return { remove: () => undefined };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: unknown = response.notification.request.content.data;
      const record = isRecord(data) ? data : {};
      const url = safeUrl(record.url);
      if (url) listener(url);
    });
    return { remove: () => subscription.remove() };
  }

  public getInitialUrl(): string | undefined {
    if (Platform.OS === 'web') return undefined;
    try {
      const response = Notifications.getLastNotificationResponse();
      const data: unknown = response?.notification.request.content.data;
      const record = isRecord(data) ? data : {};
      return safeUrl(record.url);
    } catch {
      return undefined;
    }
  }

  public openSystemSettings(): Promise<void> {
    return Linking.openSettings();
  }
}

export const notificationService = new NotificationService();
