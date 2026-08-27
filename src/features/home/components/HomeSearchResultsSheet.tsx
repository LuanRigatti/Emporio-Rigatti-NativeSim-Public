import { useState } from 'react';

import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import HomeSearchResultsContent from './HomeSearchResultsContent';

const HOME_SEARCH_INITIAL_DETENT = { fraction: 0.58 } as const;
const HOME_SEARCH_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = [
  HOME_SEARCH_INITIAL_DETENT,
  'large',
];

type Props = {
  loading: boolean;
  onDismiss: () => void;
  onImplementationReady: (implementation: 'swiftui' | 'fallback') => void;
  onVisibleChange: (visible: boolean) => void;
  response: HomeSearchResponse | null;
  visible: boolean;
};

export function HomeSearchResultsSheet({
  loading,
  onDismiss,
  onImplementationReady,
  onVisibleChange,
  response,
  visible,
}: Props) {
  const [isLarge, setIsLarge] = useState(false);

  const handleVisibleChange = (nextVisible: boolean) => {
    if (!nextVisible) setIsLarge(false);
    onVisibleChange(nextVisible);
  };
  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <NativeBottomSheet
      content={<HomeSearchResultsContent isLarge={isLarge} loading={loading} response={response} />}
      detents={HOME_SEARCH_DETENTS}
      hostSizing="viewport"
      items={[]}
      initialDetent={HOME_SEARCH_INITIAL_DETENT}
      onDismiss={handleDismiss}
      onDetentChange={(detent) => setIsLarge(detent === 'large')}
      onImplementationReady={onImplementationReady}
      onVisibleChange={handleVisibleChange}
      presentationBackgroundMode="transparent"
      title="Resultados"
      visible={visible}
    />
  );
}
