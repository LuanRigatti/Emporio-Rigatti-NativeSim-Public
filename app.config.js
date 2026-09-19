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

const selectedGoogleServicesPath = path.resolve(process.cwd(), googleServicesFile);
const selectedGoogleIosClientId = readPlistString(selectedGoogleServicesPath, 'CLIENT_ID');
const selectedGoogleReversedClientId = readPlistString(
  selectedGoogleServicesPath,
  'REVERSED_CLIENT_ID',
);
const configuredScheme =
  isFinalVariant && selectedGoogleReversedClientId
    ? [appScheme, selectedGoogleReversedClientId]
    : appScheme;
const finalGoogleUrlSchemes =
  isFinalVariant && selectedGoogleReversedClientId
    ? [appScheme, appBundleIdentifier, selectedGoogleReversedClientId]
    : undefined;

module.exports = {
  expo: {
    name: appName,
    slug: 'emporio-rigatti',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: configuredScheme,
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
        ...(finalGoogleUrlSchemes
          ? {
              CFBundleURLTypes: [{ CFBundleURLSchemes: finalGoogleUrlSchemes }],
            }
          : {}),
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
    extra: {
      eas: {
        projectId: 'ef8d9f2e-7d9e-4333-8295-3ecd545db347',
      },
      ...(isFinalVariant ? { appVariant: 'final' } : {}),
      ...(selectedGoogleIosClientId ? { googleIosClientId: selectedGoogleIosClientId } : {}),
    },
    plugins: [
      'expo-router',
      ...(isFinalVariant ? [['expo-dev-client', { addGeneratedScheme: false }]] : []),
      './plugins/withHomeScreenQuickActions',
      './plugins/withRNScreensHideBottomBarWhenPushed',
      'expo-font',
      [
        'expo-camera',
        {
          cameraPermission:
            'O Empório Rigatti usa a câmera para adicionar fotos à pesquisa.',
          microphonePermission: false,
          recordAudioAndroid: false,
          barcodeScannerEnabled: false,
        },
      ],
      'expo-image',
      [
        'expo-media-library',
        {
          photosPermission: 'O Empório Rigatti usa suas fotos para anexos.',
          granularPermissions: ['photo'],
        },
      ],
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
