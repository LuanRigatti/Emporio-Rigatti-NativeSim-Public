import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, frame, padding, shapes } from '@expo/ui/swift-ui/modifiers';

import { NATIVE_SHEET_CARD_BACKGROUND } from '@/components/native/nativeSheetBackground';
import { roundedFont } from '@/components/native/nativeTypography';

type Props = {
  query: string;
};

const prototypeResults = [
  { icon: 'person.crop.circle', label: 'Cliente', title: 'Prévia de cliente' },
  { icon: 'shippingbox', label: 'Entrega', title: 'Prévia de entrega' },
  { icon: 'checkmark.circle', label: 'Recebimento', title: 'Prévia de recebimento' },
] as const;

export default function HomeSearchPrototypeContent({ query }: Props) {
  return (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[padding({ horizontal: 20, top: 20, bottom: 28 }), frame({ maxWidth: 1000 })]}
    >
      <Text modifiers={[roundedFont({ size: 24, weight: 'bold' })]}>Resultados</Text>
      <Text modifiers={[roundedFont({ size: 17 })]}>Resultados para “{query}”</Text>
      <HStack alignment="center" spacing={8}>
        <Image size={16} systemName="sparkles" />
        <Text modifiers={[roundedFont({ size: 14 })]}>Busca inteligente</Text>
      </HStack>
      {prototypeResults.map((result) => (
        <VStack
          key={result.label}
          alignment="leading"
          spacing={6}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            padding({ all: 16 }),
            background(
              NATIVE_SHEET_CARD_BACKGROUND,
              shapes.roundedRectangle({ cornerRadius: 24, roundedCornerStyle: 'continuous' }),
            ),
          ]}
        >
          <HStack alignment="center" spacing={10}>
            <Image size={20} systemName={result.icon} />
            <Text modifiers={[roundedFont({ size: 14 })]}>{result.label}</Text>
            <Spacer />
          </HStack>
          <Text modifiers={[roundedFont({ size: 17, weight: 'semibold' })]}>{result.title}</Text>
        </VStack>
      ))}
    </VStack>
  );
}
