import { useEffect } from 'react';

import { NativeBottomSheet } from '@/components/native';
import type { NativeBottomSheetProps } from '@/components/native';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import { logHomeSearchFlow } from '../debug/HomeSearchFlowDebug';
import HomeSearchResultsContent from './HomeSearchResultsContent';

const HOME_SEARCH_DETENTS: NonNullable<NativeBottomSheetProps['detents']> = [{ fraction: 0.58 }];

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

  return (
    <NativeBottomSheet
      content={<HomeSearchResultsContent response={response} />}
      detents={HOME_SEARCH_DETENTS}
      items={[]}
      onDismiss={onDismiss}
      onImplementationReady={onImplementationReady}
      onVisibleChange={onVisibleChange}
      title="Resultados"
      visible={visible}
    />
  );
}
