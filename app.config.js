const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;

module.exports = {
  expo: {
    name: 'PAReact',
    slug: 'PAReact',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'pareact',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'com.pareact.mobile',
      buildNumber: '1',
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
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      'expo-sharing',
      'expo-status-bar',
      [
        'expo-notifications',
        {
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: true,
        },
      ],
      'expo-maps',
    ],
  },
};
