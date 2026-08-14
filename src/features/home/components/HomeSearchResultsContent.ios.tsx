import { Text, VStack } from '@expo/ui/swift-ui';
import { foregroundColor, padding } from '@expo/ui/swift-ui/modifiers';

import { roundedFont } from '@/components/native/nativeTypography';

import type { HomeSearchResponse } from '../search/HomeSearchTypes';
import { createHomeSearchResultsPresentation } from './HomeSearchResultsPresentation';

type Props = {
  response: HomeSearchResponse | null;
};

export default function HomeSearchResultsContent({ response }: Props) {
  if (!response) return <VStack>{null}</VStack>;
  const presentation = createHomeSearchResultsPresentation(response);

  if (presentation.empty) {
    return (
      <VStack
        alignment="leading"
        spacing={10}
        modifiers={[padding({ horizontal: 24, top: 24, bottom: 32 })]}
      >
        <Text modifiers={[roundedFont({ size: 24, weight: 'bold' })]}>Nenhum resultado</Text>
        <Text modifiers={[foregroundColor('#8B8B93'), roundedFont({ size: 17 })]}>
          {presentation.query}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[padding({ horizontal: 24, top: 24, bottom: 32 })]}
    >
      <Text modifiers={[foregroundColor('#8B8B93'), roundedFont({ size: 14 })]}>
        {presentation.query}
      </Text>
      <Text modifiers={[roundedFont({ size: 28, weight: 'bold' })]}>
        {presentation.primaryTitle}
      </Text>
      <Text modifiers={[foregroundColor('#8B8B93'), roundedFont({ size: 15 })]}>
        {presentation.typeLabel}
      </Text>
      <Text modifiers={[roundedFont({ size: 17 })]}>{presentation.relatedCount}</Text>
      {presentation.details?.map((detail) => (
        <Text key={detail} modifiers={[roundedFont({ size: 17 })]}>
          {detail}
        </Text>
      ))}
      {presentation.quantity !== undefined ? (
        <Text modifiers={[roundedFont({ size: 17 })]}>{presentation.quantity} baldes</Text>
      ) : null}
      {presentation.period ? (
        <Text modifiers={[foregroundColor('#8B8B93'), roundedFont({ size: 17 })]}>
          {presentation.period}
        </Text>
      ) : null}
    </VStack>
  );
}
