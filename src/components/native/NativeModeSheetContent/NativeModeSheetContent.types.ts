import type { AppMode } from '@/types/appMode';

export type NativeModeSheetContentProps = {
  mode: AppMode;
  onSelect: (mode: AppMode) => void;
};

export const NATIVE_MODE_OPTIONS = [
  {
    mode: 'wholesale',
    title: 'Atacado',
  },
  {
    mode: 'retail',
    title: 'Varejo',
  },
] as const satisfies readonly {
  mode: AppMode;
  title: string;
}[];
