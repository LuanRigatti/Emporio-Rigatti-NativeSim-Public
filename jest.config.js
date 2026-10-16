/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  resolver: 'react-native-reanimated/jest/resolver',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: [
    require.resolve('react-native-gesture-handler/jestSetup.js'),
    require.resolve('./jest.setup.js'),
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};
