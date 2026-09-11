import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type NativeQuickActionEvent = {
  type: string;
};

type NativeQuickActionsModule = {
  addListener: (
    eventName: 'onQuickAction',
    listener: (event: NativeQuickActionEvent) => void,
  ) => { remove: () => void };
};

export const nativeQuickActions: NativeQuickActionsModule | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<NativeQuickActionsModule>('NativeQuickActions')
    : null;
