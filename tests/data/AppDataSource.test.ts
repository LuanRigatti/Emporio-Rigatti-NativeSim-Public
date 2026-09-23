import { loadAppData, loadAppDataResult } from '@/services/data/AppDataSource';

const mockLoadSettings = jest.fn();
const mockGetDeliveries = jest.fn();

jest.mock('@/config/featureFlags', () => ({
  ENABLE_FIREBASE_APP_DATA: false,
}));

jest.mock('@/services/costs', () => ({
  COST_SETTINGS_DEFAULT_SCOPE: 'test-scope',
  localDailyDataDataSource: {
    load: (...args: unknown[]) => mockLoadSettings(...args),
  },
}));

jest.mock('@/services/data/UserDataService', () => ({
  userDataService: {
    loadWithCacheFallback: jest.fn(),
  },
}));

jest.mock('@/services/deliveries/DeliveryDataSource', () => ({
  mockDeliveryDataSource: {
    getAll: (...args: unknown[]) => mockGetDeliveries(...args),
  },
}));

describe('AppDataSource all-time metadata', () => {
  beforeEach(() => {
    mockLoadSettings.mockResolvedValue({
      periods: {
        day: {
          '2026-08-06': {
            estar: '10',
            fuel: '20',
            fuelPrice: '5',
            fuelType: 'comum',
            kilometers: '12',
            light: '',
            other: '0',
          },
        },
        month: { '2026-08': { light: '30' } },
        year: {},
      },
    });
    mockGetDeliveries.mockReturnValue([]);
  });

  it('keeps the snapshot API and exposes local provenance separately', async () => {
    const result = await loadAppDataResult('uid-1');

    expect(result).toMatchObject({ isStale: false, source: 'local' });
    expect(result.snapshot.gastosDiarios['2026-08-06']).toMatchObject({
      data: '2026-08-06',
      gasolina: 20,
    });
    await expect(loadAppData('uid-1')).resolves.toEqual(result.snapshot);
  });
});
