import {
  fuelCostCalculationService,
  parseKmPerLiter,
} from '@/services/expenses/FuelCostCalculationService';

const consumption = {
  ethanolKmL: 5.6,
  gasolineKmL: 7.4,
};

describe('FuelCostCalculationService', () => {
  it('reads gasoline and ethanol consumption from CarSettings', () => {
    expect(
      fuelCostCalculationService.fromCarSettings({
        alcoholAutonomy: '5,6 Km/l',
        gasolineAutonomy: '7,4 Km/l',
      }),
    ).toEqual(consumption);
  });

  it('calculates gasoline cost from total kilometers, consumption and price', () => {
    expect(
      fuelCostCalculationService.calculate({
        consumption,
        fuelPrice: 5.69,
        fuelType: 'gasolina',
        kilometers: 90,
      }),
    ).toBeCloseTo((90 / 7.4) * 5.69, 8);
  });

  it('uses the specific ethanol consumption', () => {
    expect(
      fuelCostCalculationService.calculate({
        consumption,
        fuelPrice: 5.69,
        fuelType: 'etanol',
        kilometers: 90,
      }),
    ).toBeCloseTo((90 / 5.6) * 5.69, 8);
  });

  it('returns zero for zero kilometers or zero price', () => {
    expect(
      fuelCostCalculationService.calculate({
        consumption,
        fuelPrice: 5.69,
        fuelType: 'gasolina',
        kilometers: 0,
      }),
    ).toBe(0);
    expect(
      fuelCostCalculationService.calculate({
        consumption,
        fuelPrice: 0,
        fuelType: 'gasolina',
        kilometers: 90,
      }),
    ).toBe(0);
  });

  it('changes only the consumption when the fuel type changes', () => {
    const gasoline = fuelCostCalculationService.calculate({
      consumption,
      fuelPrice: 5.69,
      fuelType: 'gasolina',
      kilometers: 90,
    });
    const ethanol = fuelCostCalculationService.calculate({
      consumption,
      fuelPrice: 5.69,
      fuelType: 'etanol',
      kilometers: 90,
    });

    expect(gasoline).not.toBe(ethanol);
    expect(gasoline).toBeCloseTo((90 / 7.4) * 5.69, 8);
    expect(ethanol).toBeCloseTo((90 / 5.6) * 5.69, 8);
  });

  it('does not invent a hardcoded consumption for invalid car settings', () => {
    expect(parseKmPerLiter('')).toBe(0);
    expect(parseKmPerLiter('sem configuração')).toBe(0);
    expect(
      fuelCostCalculationService.calculate({
        consumption: { ethanolKmL: 0, gasolineKmL: 0 },
        fuelPrice: 5.69,
        fuelType: 'gasolina',
        kilometers: 90,
      }),
    ).toBe(0);
  });
});
