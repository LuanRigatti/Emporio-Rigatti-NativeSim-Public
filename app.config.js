const fs = require('fs');
const path = require('path');

const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
const isFinalVariant = process.env.APP_VARIANT === 'final';
const appName = isFinalVariant ? 'Empório Rigatti Final' : 'Empório Rigatti';
const appScheme = isFinalVariant ? 'pareact-final' : 'pareact';
const appBundleIdentifier = isFinalVariant ? 'com.pareact.mobile.final' : 'com.pareact.mobile';
const googleServicesFile = isFinalVariant
  ? './GoogleService-Info.final.plist'
  : './GoogleService-Info.plist';

function readPlistString(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;

  const contents = fs.readFileSync(filePath, 'utf8');
  const match = contents.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return match?.[1]?.trim();
}

const finalGoogleServicesPath = path.resolve(process.cwd(), 'GoogleService-Info.final.plist');
const finalGoogleIosClientId = isFinalVariant
  ? readPlistString(finalGoogleServicesPath, 'CLIENT_ID')
  : undefined;

module.exports = {
  expo: {
    name: appName,
    slug: 'PAReact',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: appScheme,
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: appBundleIdentifier,
      buildNumber: '1',
      googleServicesFile,
      icon: {
        dark: './assets/app-icon-dark.png',
        light: './assets/app-icon-light.png',
      },
      supportsTablet: true,
      infoPlist: {
        LSApplicationQueriesSchemes: ['comgooglemaps'],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      ...(androidMapsKey
        ? {
            config: {
              googleMaps: { apiKey: androidMapsKey },
            },
          }
        : {}),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    experiments: {
      tsconfigPaths: true,
    },
    ...(isFinalVariant
      ? {
          extra: {
            appVariant: 'final',
            ...(finalGoogleIosClientId ? { googleIosClientId: finalGoogleIosClientId } : {}),
          },
        }
      : {}),
    plugins: [
      'expo-router',
      ...(isFinalVariant ? [['expo-dev-client', { addGeneratedScheme: false }]] : []),
      './plugins/withHomeScreenQuickActions',
      'expo-font',
      [
        'expo-location',
        {
          isIosBackgroundLocationEnabled: true,
          locationAlwaysAndWhenInUsePermission:
            'O Empório Rigatti usa sua localização durante uma rota ativa, mesmo quando o app está em segundo plano.',
          locationWhenInUsePermission:
            'O Empório Rigatti usa sua localização para calcular a distância de uma rota ativa.',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FAF8F7',
          dark: {
            backgroundColor: '#0B0F14',
          },
        },
      ],
      'expo-web-browser',
      'expo-sharing',
      'expo-status-bar',
      '@react-native-google-signin/google-signin',
      [
        'expo-notifications',
        {
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: true,
        },
      ],
      'expo-maps',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'O Face ID será usado para desbloquear o aplicativo com segurança.',
        },
      ],
    ],
  },
};
