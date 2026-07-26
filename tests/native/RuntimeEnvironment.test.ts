import { ExecutionEnvironment } from 'expo-constants';

import { classifyRuntimeEnvironment } from '@/platform/runtimeEnvironment';

describe('classifyRuntimeEnvironment', () => {
  it('prioritizes Web regardless of the native execution environment', () => {
    expect(
      classifyRuntimeEnvironment({
        executionEnvironment: ExecutionEnvironment.StoreClient,
        expoGo: true,
        platform: 'web',
      }),
    ).toBe('web');
  });

  it('identifies Expo Go through the execution environment', () => {
    expect(
      classifyRuntimeEnvironment({
        executionEnvironment: ExecutionEnvironment.StoreClient,
        expoGo: false,
        platform: 'ios',
      }),
    ).toBe('expo-go');
  });

  it('identifies an iOS development build', () => {
    expect(
      classifyRuntimeEnvironment({
        executionEnvironment: ExecutionEnvironment.Standalone,
        expoGo: false,
        platform: 'ios',
      }),
    ).toBe('development-build');
  });
});
