export type NotificationPlatform = 'web' | 'ios' | 'android';

export type NotificationPermissionState =
  'unknown' | 'unsupported' | 'undetermined' | 'granted' | 'provisional' | 'denied';

export type NotificationKind = 'new_delivery' | 'collection_reminder' | 'test';

export interface NotificationStatus {
  platform: NotificationPlatform;
  permission: NotificationPermissionState;
  canAskAgain: boolean;
  tokenRegistered: boolean;
}

export interface AppNotificationEvent {
  kind: NotificationKind;
  title: string;
  body: string;
  url?: string;
}
