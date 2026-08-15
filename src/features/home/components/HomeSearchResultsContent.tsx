import { View } from 'react-native';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import HomeSearchResultsFallback from './HomeSearchResultsFallback';
import { createHomeSearchResultVisualModel } from './HomeSearchResultsVisualModel';

type Props = {
  isLarge?: boolean;
  response: HomeSearchResponse | null;
};

export default function HomeSearchResultsContent({ response }: Props) {
  if (!response) return <View />;
  return <HomeSearchResultsFallback model={createHomeSearchResultVisualModel(response)} />;
}
