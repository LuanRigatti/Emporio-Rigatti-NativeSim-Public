import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';

import HomeSearchHelpContent from './HomeSearchHelpContent';

const HELP_SHEET_INITIAL_DETENT = { fraction: 0.45 } as const;
const HELP_SHEET_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = [
  HELP_SHEET_INITIAL_DETENT,
];

type Props = {
  onDismiss: () => void;
  onSelectQuery: (query: string) => void;
  visible: boolean;
};

export function HomeSearchHelpSheet({ onDismiss, onSelectQuery, visible }: Props) {
  const handleVisibleChange = (nextVisible: boolean) => {
    if (!nextVisible) {
      onDismiss();
    }
  };

  return (
    <NativeBottomSheet
      content={<HomeSearchHelpContent onSelectQuery={onSelectQuery} />}
      detents={HELP_SHEET_DETENTS}
      hostSizing="viewport"
      items={[]}
      initialDetent={HELP_SHEET_INITIAL_DETENT}
      onDismiss={onDismiss}
      onVisibleChange={handleVisibleChange}
      title="O que posso pesquisar?"
      presentationBackgroundMode="transparent"
      visible={visible}
    />
  );
}
