import type { CarSettings } from '@/services/car';

export type FuelType = 'gasolina' | 'etanol';

export type FuelConsumption = {
  gasolineKmL: number;
  ethanolKmL: number;
};

export type FuelCostInput = {
  kilometers: number;
  fuelPrice: number;
  fuelType: FuelType;
  consumption: FuelConsumption;
};

export class FuelCostCalculationService {
  public fromCarSettings(settings: CarSettings): FuelConsumption {
    return {
      ethanolKmL: parseKmPerLiter(settings.alcoholAutonomy),
      gasolineKmL: parseKmPerLiter(settings.gasolineAutonomy),
    };
  }

  public calculate({ kilometers, fuelPrice, fuelType, consumption }: FuelCostInput): number {
    const normalizedKilometers = finiteNonNegative(kilometers);
    const normalizedFuelPrice = finiteNonNegative(fuelPrice);
    const consumptionKmL =
      fuelType === 'etanol'
        ? finitePositive(consumption.ethanolKmL)
        : finitePositive(consumption.gasolineKmL);

    if (normalizedKilometers <= 0 || normalizedFuelPrice <= 0 || consumptionKmL <= 0) return 0;

    return (normalizedKilometers / consumptionKmL) * normalizedFuelPrice;
  }
}

export const fuelCostCalculationService = new FuelCostCalculationService();

export function parseKmPerLiter(value: string): number {
  const normalized = value.trim().replace(/km\/l/gi, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
