const fs = require('fs');
const path = require('path');
const { AndroidConfig, withSettingsGradle, withStringsXml } = require('expo/config-plugins');

const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
const isFinalVariant = process.env.APP_VARIANT === 'final';
const isReleaseVariant = process.env.APP_VARIANT === 'release';
const isIsolatedIosVariant = isFinalVariant || isReleaseVariant;
const appName = isFinalVariant ? 'Empório Rigatti Final' : 'Empório Rigatti';
const iosProjectName = 'emporiorigatti';
const appScheme = isFinalVariant
  ? 'pareact-final'
  : isReleaseVariant
    ? 'pareact-release'
    : 'pareact';
const appBundleIdentifier = isFinalVariant
  ? 'com.pareact.mobile.final'
  : isReleaseVariant
    ? 'com.pareact.mobile.release'
    : 'com.pareact.mobile';
const googleServicesFile = isFinalVariant
  ? './GoogleService-Info.final.plist'
  : isReleaseVariant
    ? './GoogleService-Info.release.plist'
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
  isIsolatedIosVariant && selectedGoogleReversedClientId
    ? [appScheme, selectedGoogleReversedClientId]
    : appScheme;
const isolatedVariantGoogleUrlSchemes =
  isIsolatedIosVariant && selectedGoogleReversedClientId
    ? [appScheme, appBundleIdentifier, selectedGoogleReversedClientId]
    : undefined;

function withAndroidNames(config) {
  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: appName })],
      config.modResults,
    );
    return config;
  });

  return withSettingsGradle(config, (config) => {
    config.modResults.contents = AndroidConfig.Name.applyNameSettingsGradle(
      { name: appName },
      config.modResults.contents,
    );
    return config;
  });
}

module.exports = {
  expo: {
    name: iosProjectName,
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
        CFBundleDisplayName: appName,
        LSApplicationQueriesSchemes: ['comgooglemaps'],
        ...(isolatedVariantGoogleUrlSchemes
          ? {
              CFBundleURLTypes: [{ CFBundleURLSchemes: isolatedVariantGoogleUrlSchemes }],
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
      ...(isReleaseVariant ? { appVariant: 'release' } : {}),
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
          cameraPermission: 'O Empório Rigatti usa a câmera para adicionar fotos à pesquisa.',
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
      [
        // CNG dangerous mods run in reverse plugin order; this patches Swift after expo-widgets generates it.
        './plugins/withResumoFinanceiroDiagnostics',
      ],
      [
        'expo-widgets',
        {
          enablePushNotifications: false,
          widgets: [
            {
              name: 'ResumoFinanceiro',
              displayName: 'Resumo Financeiro',
              description: 'Faturamento e lucro líquido do mês.',
              ios: {
                supportedFamilies: ['systemMedium'],
                configuration: {
                  title: 'Modo Financeiro',
                  description: 'Escolha os dados de Atacado ou Varejo.',
                  parameters: {
                    mode: {
                      title: 'Modo',
                      type: 'enum',
                      values: [
                        { name: 'Atacado', value: 'wholesale' },
                        { name: 'Varejo', value: 'retail' },
                      ],
                      default: 'wholesale',
                    },
                  },
                },
              },
            },
          ],
        },
      ],
      'expo-maps',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'O Face ID será usado para desbloquear o aplicativo com segurança.',
        },
      ],
      withAndroidNames,
    ],
  },
};
