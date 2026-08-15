import { VStack } from '@expo/ui/swift-ui';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import HomeSearchResultsNative from './HomeSearchResultsNative.ios';
import { createHomeSearchResultVisualModel } from './HomeSearchResultsVisualModel';

type Props = {
  isLarge?: boolean;
  response: HomeSearchResponse | null;
};

export default function HomeSearchResultsContent({ isLarge = false, response }: Props) {
  if (!response) return <VStack>{null}</VStack>;
  return (
    <HomeSearchResultsNative
      isLarge={isLarge}
      model={createHomeSearchResultVisualModel(response)}
    />
  );
}
