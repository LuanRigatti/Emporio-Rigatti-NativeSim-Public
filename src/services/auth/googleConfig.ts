import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getAppVariant } from '@/config';

export interface GoogleClientIds {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

export function getGoogleClientIds(): GoogleClientIds {
  const configuredIosClientId =
    typeof Constants.expoConfig?.extra?.googleIosClientId === 'string'
      ? Constants.expoConfig.extra.googleIosClientId
      : undefined;
  const fallbackIosClientId =
    getAppVariant() === 'final' ? undefined : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: configuredIosClientId || fallbackIosClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  };
}

export function getGoogleClientIdForCurrentPlatform(
  clientIds: GoogleClientIds = getGoogleClientIds(),
): string | undefined {
  if (Platform.OS === 'ios') return clientIds.iosClientId;
  if (Platform.OS === 'android') return clientIds.androidClientId;
  return clientIds.webClientId;
}
