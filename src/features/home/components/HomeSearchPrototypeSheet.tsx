import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';

import HomeSearchPrototypeContent from './HomeSearchPrototypeContent';

const SEARCH_SHEET_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = ['large'];

type Props = {
  onVisibleChange: (visible: boolean) => void;
  query: string;
  visible: boolean;
};

export function HomeSearchPrototypeSheet({ onVisibleChange, query, visible }: Props) {
  return (
    <NativeBottomSheet
      content={<HomeSearchPrototypeContent query={query} />}
      detents={SEARCH_SHEET_DETENTS}
      initialDetent="large"
      items={[]}
      onVisibleChange={onVisibleChange}
      title="Resultados"
      visible={visible}
    />
  );
}
