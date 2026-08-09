import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';

import HomeSearchPrototypeContent from './HomeSearchPrototypeContent';

const SEARCH_SHEET_DETENT: NonNullable<NativeBottomSheetProps['initialDetent']> = {
  fraction: 0.88,
};

type Props = {
  onVisibleChange: (visible: boolean) => void;
  query: string;
  visible: boolean;
};

export function HomeSearchPrototypeSheet({ onVisibleChange, query, visible }: Props) {
  return (
    <NativeBottomSheet
      content={<HomeSearchPrototypeContent query={query} />}
      initialDetent={SEARCH_SHEET_DETENT}
      items={[]}
      onVisibleChange={onVisibleChange}
      title="Resultados"
      visible={visible}
    />
  );
}
