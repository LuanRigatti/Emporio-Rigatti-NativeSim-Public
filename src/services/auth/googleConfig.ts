import { Platform } from 'react-native';

export interface GoogleClientIds {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

export function getGoogleClientIds(): GoogleClientIds {
  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
