/* global jest */

jest.mock('expo-font', () => {
  const actual = jest.requireActual('expo-font');

  return {
    ...actual,
    loadAsync: jest.fn().mockResolvedValue(undefined),
  };
});

if (typeof global.requestIdleCallback !== 'function') {
  global.requestIdleCallback = (callback) =>
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
}

if (typeof global.cancelIdleCallback !== 'function') {
  global.cancelIdleCallback = (callbackId) => clearTimeout(callbackId);
}

require('react-native-reanimated').setUpTests();
