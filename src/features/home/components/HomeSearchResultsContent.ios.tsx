import { ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { font, padding } from '@expo/ui/swift-ui/modifiers';

import { spacing } from '@/theme';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import HomeSearchResultsNative from './HomeSearchResultsNative.ios';
import { createHomeSearchResultVisualModel } from './HomeSearchResultsVisualModel';

type Props = {
  isLarge?: boolean;
  loading: boolean;
  response: HomeSearchResponse | null;
};

export default function HomeSearchResultsContent({
  isLarge = false,
  loading,
  response,
}: Props) {
  if (!response) {
    return loading ? (
      <VStack
        alignment="center"
        spacing={spacing.sm}
        modifiers={[padding({ vertical: spacing.xxl })]}
      >
        <ProgressView />
        <Text modifiers={[font({ textStyle: 'subheadline', design: 'rounded' })]}>
          Buscando…
        </Text>
      </VStack>
    ) : (
      <VStack>{null}</VStack>
    );
  }
  return (
    <HomeSearchResultsNative
      isLarge={isLarge}
      model={createHomeSearchResultVisualModel(response)}
    />
  );
}
