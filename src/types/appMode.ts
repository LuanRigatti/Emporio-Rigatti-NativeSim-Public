export type AppMode = 'wholesale' | 'retail';

export const DEFAULT_APP_MODE: AppMode = 'wholesale';

export function isAppMode(value: unknown): value is AppMode {
  return value === 'wholesale' || value === 'retail';
}
