import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type DeliveryWidgetActionReceipt = {
  id: string;
  date: string;
  revision: number;
};

export type DeliveryWidgetAuthorizationMetadata = {
  sessionId: string;
  uid: string;
  sessionVersion: number;
  expiresAt: number;
  absoluteExpiresAt: number;
};

export type DeliveryWidgetActionsNativeModule = {
  deliveryWidgetAuthorizationMetadata: () => DeliveryWidgetAuthorizationMetadata | null;
  prepareDeliveryWidgetAuthorizationSession: (
    uid: string | null,
    sessionVersion: number,
  ) => boolean;
  storeDeliveryWidgetAuthorization: (
    sessionId: string,
    uid: string,
    sessionVersion: number,
    capability: string,
    expiresAt: number,
    absoluteExpiresAt: number,
  ) => Promise<boolean>;
  revokeDeliveryWidgetAuthorization: () => Promise<boolean>;
  flushDeliveryWidgetRevocations: () => Promise<boolean>;
  deliveryWidgetActionRevision: (sessionId: string, date: string) => number;
  pendingDeliveryWidgetActionReceipts: (uid: string) => DeliveryWidgetActionReceipt[];
  acknowledgeDeliveryWidgetActionReceipts: (identifiers: string[]) => void;
};

let nativeModule: DeliveryWidgetActionsNativeModule | null = null;

if (Platform.OS === 'ios') {
  try {
    nativeModule = requireOptionalNativeModule<DeliveryWidgetActionsNativeModule>('ExpoWidgets');
  } catch {
    nativeModule = null;
  }
}

export function getDeliveryWidgetActionsNative(): DeliveryWidgetActionsNativeModule | null {
  return nativeModule;
}
