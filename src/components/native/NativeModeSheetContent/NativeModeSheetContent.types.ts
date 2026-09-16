import type { AppMode } from '@/types/appMode';

export type NativeModeSheetContentProps = {
  mode: AppMode;
  onSelect: (mode: AppMode) => void;
};

export const NATIVE_MODE_OPTIONS = [
  {
    mode: 'wholesale',
    title: 'Atacado',
    description: 'Operação atual de baldes/atacado',
  },
  {
    mode: 'retail',
    title: 'Varejo',
    description: 'Cestas, salgados e vendas particulares',
  },
] as const satisfies readonly {
  mode: AppMode;
  title: string;
  description: string;
}[];
