import AsyncStorage from '@react-native-async-storage/async-storage';

import { CostSettingsStorage } from '@/services/costs/CostSettingsStorage';

const storedValue = JSON.stringify({
  periods: {
    day: {
      '2026-08-09': {
        estar: '35',
        other: '',
        fuel: '',
        fuelPrice: '5.69',
        fuelType: 'gasolina',
        kilometers: '90',
        light: '',
      },
    },
    month: {},
    year: {},
  },
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

describe('CostSettingsStorage hydration cache', () => {
  beforeEach(() => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(storedValue);
    jest.mocked(AsyncStorage.getItem).mockClear();
  });

  it('reuses the last loaded snapshot before another async read', async () => {
    const storage = new CostSettingsStorage();
    const first = await storage.load();
    const second = await storage.load();

    expect(first.periods.day['2026-08-09']?.fuelPrice).toBe('5.69');
    expect(storage.getCached()).toEqual(first);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  });

  it('keeps a real zero distinct from an empty value before hydration', async () => {
    const storage = new CostSettingsStorage();
    const settings = {
      periods: {
        day: {
          '2026-08-09': {
            estar: '0',
            other: '',
            fuel: '',
            fuelPrice: '',
            fuelType: '',
            kilometers: '',
            light: '',
          },
        },
        month: {},
        year: {},
      },
    };

    await storage.save(settings);

    expect(storage.getCached()?.periods.day['2026-08-09']?.estar).toBe('0');
  });
});
