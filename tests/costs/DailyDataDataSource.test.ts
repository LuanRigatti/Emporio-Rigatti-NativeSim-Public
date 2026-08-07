import {
  firebaseDailyDataDataSource,
  LocalDailyDataDataSource,
  dailyDataQueryService,
} from '@/services/costs';
import { addDailyValue, setDailyValue } from '@/services/costs/dailyDataAggregation';
import type { CostSettings } from '@/services/costs/CostSettingsStorage';
import {
  COST_SETTINGS_STORAGE_KEY,
  CostSettingsStorage,
} from '@/services/costs/CostSettingsStorage';
import { toFirebaseDailyExpenses } from '@/mappers/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const storageState: { value: CostSettings } = {
  value: { periods: { day: {}, month: {}, year: {} } },
};
const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

const source = new LocalDailyDataDataSource({
  load: async () => storageState.value,
  save: async (settings) => {
    storageState.value = settings;
  },
});

describe('daily data datasource preparation', () => {
  beforeEach(() => {
    storageState.value = { periods: { day: {}, month: {}, year: {} } };
    mockStorage.clear();
  });

  it('starts empty and persists local values across datasource reloads', async () => {
    expect((await source.load()).periods.day).toEqual({});

    const settings: CostSettings = {
      periods: {
        day: {
          '2026-08-06': {
            estar: '10',
            fuel: '',
            fuelPrice: '6,59',
            fuelType: '',
            kilometers: '5',
            light: '',
            other: '4',
          },
        },
        month: {},
        year: {},
      },
    };
    await source.save(settings);

    await expect(source.load()).resolves.toEqual(settings);
  });

  it('persists the selected fuel type across datasource reloads', async () => {
    const settings: CostSettings = {
      periods: {
        day: {
          '2026-08-06': {
            estar: '',
            fuel: '',
            fuelPrice: '5,69',
            fuelType: 'etanol',
            kilometers: '',
            light: '',
            other: '',
          },
        },
        month: {},
        year: {},
      },
    };

    await source.save(settings);

    await expect(source.load()).resolves.toEqual(settings);
  });

  it('keeps older local settings readable when fuelType is absent', async () => {
    await AsyncStorage.setItem(
      COST_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        periods: {
          day: {
            '2026-08-06': {
              estar: '10',
              fuel: '20',
              fuelPrice: '6,59',
              kilometers: '5',
              other: '4',
            },
          },
          month: {},
          year: {},
        },
      }),
    );

    await expect(new CostSettingsStorage().load()).resolves.toMatchObject({
      periods: {
        day: {
          '2026-08-06': {
            estar: '10',
            fuelPrice: '6,59',
            fuelType: '',
          },
        },
      },
    });
  });

  it('keeps incremental values and supports multiple entries for the same day', () => {
    expect(addDailyValue('', '10')).toBe('10');
    expect(addDailyValue('10', '5')).toBe('15');
    expect(addDailyValue('15', '2,50')).toBe('17.5');
  });

  it('replaces the active fuel price instead of adding it', () => {
    expect(setDailyValue('6.59', '6.69')).toBe('6.69');
    expect(Number(addDailyValue('6.59', '6.69'))).toBeCloseTo(13.28);
  });

  it('separates manual, automatic and total kilometers', () => {
    expect(
      dailyDataQueryService.toRecord(
        '2026-08-06',
        {
          estar: '',
          fuel: '',
          fuelPrice: '',
          fuelType: '',
          kilometers: '5,4',
          light: '',
          other: '',
        },
        21,
      ),
    ).toMatchObject({
      automaticKilometers: 21,
      manualKilometers: 5.4,
      totalKilometers: 26.4,
    });
  });

  it('queries one route, multiple routes and excludes another day from automatic km', async () => {
    await AsyncStorage.setItem(
      '@pareact/route-tracking-history-v1',
      JSON.stringify([
        finalizedSession('route-1', '2026-08-06', 12_400),
        finalizedSession('route-2', '2026-08-06', 8_600),
        finalizedSession('route-3', '2026-08-07', 99_000),
      ]),
    );

    await expect(dailyDataQueryService.getAutomaticKilometers('2026-08-06')).resolves.toBe(21);
    await expect(dailyDataQueryService.getAutomaticKilometers('2026-08-07')).resolves.toBe(99);
    await expect(dailyDataQueryService.getAutomaticKilometers('2026-08-05')).resolves.toBe(0);
  });

  it('maps legacy Firebase fields without sending Outros or GPS details', () => {
    const payload = firebaseDailyDataDataSource.toLegacy({
      periods: {
        day: {
          '2026-08-06': {
            estar: '10',
            fuel: '20',
            fuelPrice: '6.59',
            fuelType: 'gasolina',
            kilometers: '21',
            light: '',
            other: '99',
          },
        },
        month: {
          '2026-08': {
            estar: '',
            fuel: '',
            fuelPrice: '',
            fuelType: '',
            kilometers: '',
            light: '100',
            other: '',
          },
        },
        year: {},
      },
    });

    expect(payload.gastosDiarios['2026-08-06']).toMatchObject({
      estar: 10,
      gasolina: 20,
      km: 21,
      precoGasolina: 6.59,
      tipoCombustivel: 'gasolina',
    });
    expect(payload.gastosDiarios['2026-08-06'].outros).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('samples');
    expect(payload.gastosMensais['2026-08']).toMatchObject({ luz: 100 });
    const legacyDailyNode = toFirebaseDailyExpenses({
      '2026-08-06': payload.gastosDiarios['2026-08-06'],
    })['2026-08-06'] as Record<string, unknown>;
    expect(Object.keys(legacyDailyNode).sort()).toEqual([
      'estar',
      'gasolina',
      'km',
      'precoGasolina',
      'tipoCombustivel',
    ]);
  });

  it('reads legacy Firebase daily and monthly totals into the local contract', () => {
    const settings = firebaseDailyDataDataSource.fromLegacy({
      gastosDiarios: {
        '2026-08-06': {
          data: '2026-08-06',
          estar: 10,
          gasolina: 20,
          km: 21,
          precoGasolina: 6.59,
          tipoCombustivel: 'gasolina',
        },
      },
      gastosMensais: { '2026-08': { luz: 100 } },
    });

    expect(settings.periods.day['2026-08-06']).toMatchObject({
      estar: '10',
      fuel: '20',
      fuelPrice: '6.59',
      fuelType: 'gasolina',
      kilometers: '21',
    });
    expect(settings.periods.month['2026-08'].light).toBe('100');
  });
});

function finalizedSession(id: string, date: string, distanceMeters: number) {
  return {
    date,
    distanceMeters,
    durationSeconds: 120,
    endTimestamp: 2_000,
    id,
    pointsCount: 2,
    samples: [],
    startTimestamp: 1_000,
    status: 'finalized',
  };
}
