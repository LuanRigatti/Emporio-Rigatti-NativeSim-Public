import AsyncStorage from '@react-native-async-storage/async-storage';

import { CarSettingsStorage, EMPTY_CAR_SETTINGS } from '@/services/car/CarSettingsStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('CarSettingsStorage memory cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('makes locally loaded settings available synchronously as a defensive copy', async () => {
    const storage = new CarSettingsStorage();
    const settings = { alcoholAutonomy: '8 Km/l', gasolineAutonomy: '11 Km/l' };
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(settings));

    expect(storage.getCached()).toBeNull();
    await expect(storage.load()).resolves.toEqual(settings);

    const cached = storage.getCached();
    expect(cached).toEqual(settings);
    cached!.gasolineAutonomy = 'invalid';
    expect(storage.getCached()?.gasolineAutonomy).toBe(settings.gasolineAutonomy);
  });

  it('caches remote settings for the next local-first screen and keeps default fallbacks', async () => {
    const storage = new CarSettingsStorage();
    const settings = { alcoholAutonomy: '9 Km/l', gasolineAutonomy: '12 Km/l' };

    storage.setCached(settings);

    expect(storage.getCached()).toEqual(settings);
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
    await expect(storage.load()).resolves.toEqual(EMPTY_CAR_SETTINGS);
    expect(storage.getCached()).toEqual(EMPTY_CAR_SETTINGS);
  });
});
