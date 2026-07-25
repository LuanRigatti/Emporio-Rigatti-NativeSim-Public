const staticConfig = require('./app.json');

const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;

module.exports = {
  expo: {
    ...staticConfig.expo,
    android: {
      ...staticConfig.expo.android,
      ...(androidMapsKey
        ? {
            config: {
              ...staticConfig.expo.android?.config,
              googleMaps: { apiKey: androidMapsKey },
            },
          }
        : {}),
    },
  },
};
