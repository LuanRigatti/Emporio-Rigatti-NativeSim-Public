import {
  BottomSheet,
  Button,
  Divider,
  Group,
  HStack,
  Host,
  Picker,
  ScrollView,
  Spacer,
  Text,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  background,
  buttonStyle,
  cornerRadius,
  disabled as disabledModifier,
  foregroundColor,
  frame,
  keyboardType,
  padding,
  pickerStyle,
  presentationBackground,
  presentationBackgroundInteraction as setPresentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';

import { normalizeMoney } from '@/utils/data';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { useTestModePresentation } from '@/utils/presentation/testModeValues';

import type {
  NativeRetailProductFormSheetProps,
  NativeRetailProductFormValues,
} from './NativeRetailProductFormSheet.types';
import { roundedFont } from '../nativeTypography';

type NativeTextState = NonNullable<Parameters<typeof TextField>[0]['text']>;

const EMPTY_VALUES: NativeRetailProductFormValues = {
  categoryId: '',
  flavor: '',
  packageSize: '',
  productName: '',
  skuCode: '',
  standardSalePrice: '',
  variant: '',
};

export default function NativeRetailProductFormSheetSwiftUI({
  categories,
  initialValues,
  mode = 'create',
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailProductFormSheetProps) {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailProductFormValues>(EMPTY_VALUES);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const productNameState = useNativeState('');
  const variantState = useNativeState('');
  const flavorState = useNativeState('');
  const packageSizeState = useNativeState('');
  const priceState = useNativeState('');
  const skuState = useNativeState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      const next = {
        ...EMPTY_VALUES,
        ...initialValues,
        categoryId: initialValues?.categoryId ?? categories[0]?.categoryId ?? '',
      };
      setValues(next);
      const nextIndex = categories.findIndex((category) => category.categoryId === next.categoryId);
      setCategoryIndex(Math.max(0, nextIndex));
      setError(undefined);
    }
  }, [categories, initialValues, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => productNameState.set(values.productName), [productNameState, values.productName]);
  useEffect(() => variantState.set(values.variant), [values.variant, variantState]);
  useEffect(() => flavorState.set(values.flavor), [flavorState, values.flavor]);
  useEffect(() => packageSizeState.set(values.packageSize), [packageSizeState, values.packageSize]);
  useEffect(() => priceState.set(values.standardSalePrice), [priceState, values.standardSalePrice]);
  useEffect(() => skuState.set(values.skuCode), [skuState, values.skuCode]);

  const update = (key: keyof NativeRetailProductFormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async () => {
    if (testModeEnabled || submitting) return;
    const categoryId = categories[categoryIndex]?.categoryId ?? '';
    const nextValues = { ...values, categoryId };
    if (!categoryId) {
      setError('Selecione uma categoria.');
      return;
    }
    if (!nextValues.productName.trim()) {
      setError('Informe o nome do produto.');
      return;
    }
    if (
      !nextValues.standardSalePrice.trim() ||
      normalizeMoney(nextValues.standardSalePrice) === undefined
    ) {
      setError('Informe um preço de venda válido.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await onSubmit(nextValues);
      onVisibleChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    text: NativeTextState,
    onTextChange: (value: string) => void,
    placeholder: string,
    inputKeyboardType: 'default' | 'decimal-pad',
  ) => (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 8 })]}>
      <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>{label}</Text>
      <TextField
        axis="horizontal"
        modifiers={[
          roundedFont({ textStyle: 'body' }),
          autocorrectionDisabled(inputKeyboardType === 'decimal-pad'),
          background('systemGray6'),
          cornerRadius(12),
          keyboardType(inputKeyboardType),
          ...(testModeEnabled || submitting ? [disabledModifier(true)] : []),
          padding({ horizontal: 12, vertical: 10 }),
        ]}
        onTextChange={onTextChange}
        placeholder={placeholder}
        text={text}
      />
    </VStack>
  );

  const resolvedTitle = title ?? (mode === 'edit' ? 'Editar produto' : 'Novo produto');
  return (
    <Host matchContents>
      <BottomSheet isPresented={visible} onIsPresentedChange={onVisibleChange}>
        <Group
          modifiers={[
            setPresentationBackgroundInteraction('enabled'),
            presentationBackground('systemBackground'),
            presentationDetents(['large']),
            presentationDragIndicator('visible'),
          ]}
        >
          <ScrollView showsIndicators={false}>
            <VStack
              alignment="leading"
              spacing={12}
              modifiers={[padding({ horizontal: 20, top: 12, bottom: 28 })]}
            >
              <Text modifiers={[roundedFont({ size: 22, weight: 'bold' })]}>{resolvedTitle}</Text>
              <VStack
                alignment="leading"
                spacing={0}
                modifiers={[
                  background('secondarySystemGroupedBackground'),
                  cornerRadius(20),
                  padding({ horizontal: 16, vertical: 4 }),
                ]}
              >
                <Picker
                  label="Categoria"
                  onSelectionChange={(selection) => {
                    const index = Number(selection);
                    setCategoryIndex(index);
                    update('categoryId', categories[index]?.categoryId ?? '');
                  }}
                  selection={categoryIndex}
                  modifiers={[
                    pickerStyle('menu'),
                    ...(testModeEnabled || submitting || !categories.length
                      ? [disabledModifier(true)]
                      : []),
                  ]}
                >
                  {categories.map((category, index) => (
                    <Text key={category.categoryId} modifiers={[roundedFont({}), tag(index)]}>
                      {category.label}
                    </Text>
                  ))}
                </Picker>
                <Divider />
                {field(
                  'Nome do produto',
                  productNameState,
                  (value) => update('productName', value),
                  'Ex.: Cesta Café Portugal',
                  'default',
                )}
                <Divider />
                {field(
                  'Variante/modelo',
                  variantState,
                  (value) => update('variant', value),
                  'Opcional',
                  'default',
                )}
                <Divider />
                {field(
                  'Sabor',
                  flavorState,
                  (value) => update('flavor', value),
                  'Opcional',
                  'default',
                )}
                <Divider />
                {field(
                  'Tamanho/embalagem',
                  packageSizeState,
                  (value) => update('packageSize', value),
                  'Opcional',
                  'default',
                )}
                <Divider />
                {field(
                  'Preço de venda',
                  priceState,
                  (value) => update('standardSalePrice', value),
                  'R$ 0,00',
                  'decimal-pad',
                )}
                <Divider />
                {field('SKU', skuState, (value) => update('skuCode', value), 'Opcional', 'default')}
              </VStack>
              {error ? <Text modifiers={[foregroundColor('#FF3B30')]}>{error}</Text> : null}
              <HStack modifiers={[frame({ maxWidth: 1000 })]}>
                <Spacer />
                <Button
                  label={mode === 'edit' ? 'Salvar' : 'Adicionar'}
                  modifiers={[
                    buttonStyle('glassProminent'),
                    ...(submitting || testModeEnabled ? [disabledModifier(true)] : []),
                    accessibilityLabel(mode === 'edit' ? 'Salvar produto' : 'Adicionar produto'),
                  ]}
                  onPress={() => {
                    triggerNativeButtonHaptic('light');
                    void handleSubmit();
                  }}
                />
              </HStack>
            </VStack>
          </ScrollView>
        </Group>
      </BottomSheet>
    </Host>
  );
}
