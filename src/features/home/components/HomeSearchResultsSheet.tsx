import { useEffect, useState } from 'react';

import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import { logHomeSearchFlow } from '../debug/HomeSearchFlowDebug';
import HomeSearchResultsContent from './HomeSearchResultsContent';

const HOME_SEARCH_INITIAL_DETENT = { fraction: 0.58 } as const;
const HOME_SEARCH_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = [
  HOME_SEARCH_INITIAL_DETENT,
  'large',
];

type Props = {
  onDismiss: () => void;
  onImplementationReady: (implementation: 'swiftui' | 'fallback') => void;
  onVisibleChange: (visible: boolean) => void;
  response: HomeSearchResponse | null;
  visible: boolean;
};

export function HomeSearchResultsSheet({
  onDismiss,
  onImplementationReady,
  onVisibleChange,
  response,
  visible,
}: Props) {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    logHomeSearchFlow('results-sheet-mounted');
    return () => {
      logHomeSearchFlow('results-sheet-unmounted');
    };
  }, []);

  useEffect(() => {
    if (!__DEV__ || !visible || !response) return;

    const primary = response.results[0];
    console.log('[home-search-sheet]', {
      query: response.query.original,
      resultCount: response.results.length,
      primaryType: primary?.type ?? null,
      primaryId: primary?.id ?? null,
      opened: true,
      empty: response.results.length === 0,
    });
    logHomeSearchFlow('results-sheet-visible-prop', {
      resultCount: response.results.length,
    });
  }, [response, visible]);

  const handleVisibleChange = (nextVisible: boolean) => {
    if (!nextVisible) setIsLarge(false);
    onVisibleChange(nextVisible);
  };
  const handleDismiss = () => {
    onDismiss();
  };

  return (
    <NativeBottomSheet
      content={<HomeSearchResultsContent isLarge={isLarge} response={response} />}
      detents={HOME_SEARCH_DETENTS}
      hostSizing="viewport"
      items={[]}
      initialDetent={HOME_SEARCH_INITIAL_DETENT}
      onDismiss={handleDismiss}
      onDetentChange={(detent) => setIsLarge(detent === 'large')}
      onImplementationReady={onImplementationReady}
      onVisibleChange={handleVisibleChange}
      title="Resultados"
      visible={visible}
    />
  );
}
