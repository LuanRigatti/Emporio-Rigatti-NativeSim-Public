import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getAppVariant } from '@/config';

export interface GoogleClientIds {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

export function getGoogleClientIds(): GoogleClientIds {
  const finalIosClientId =
    typeof Constants.expoConfig?.extra?.googleIosClientId === 'string'
      ? Constants.expoConfig.extra.googleIosClientId
      : undefined;

  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: getAppVariant() === 'final' ? finalIosClientId : process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
