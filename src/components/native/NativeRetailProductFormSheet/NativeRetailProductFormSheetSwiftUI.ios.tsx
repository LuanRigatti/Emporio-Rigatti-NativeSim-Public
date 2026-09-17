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
  costMode: '',
  directCostItemId: '',
  flavor: '',
  packageSize: '',
  productName: '',
  skuCode: '',
  standardSalePrice: '',
  variant: '',
};

const COST_MODE_OPTIONS = [
  { label: 'Sem custo configurado', value: '' },
  { label: 'Direto', value: 'direct' },
  { label: 'Composição', value: 'composition' },
] as const;

export default function NativeRetailProductFormSheetSwiftUI({
  categories,
  costItems = [],
  initialValues,
  mode = 'create',
  onOpenComposition,
  onSubmit,
  onVisibleChange,
  title,
  visible,
}: NativeRetailProductFormSheetProps) {
  const { enabled: testModeEnabled } = useTestModePresentation();
  const [values, setValues] = useState<NativeRetailProductFormValues>(EMPTY_VALUES);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [costModeIndex, setCostModeIndex] = useState(0);
  const [directCostItemIndex, setDirectCostItemIndex] = useState(0);
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
      const nextCostModeIndex = COST_MODE_OPTIONS.findIndex(
        (option) => option.value === next.costMode,
      );
      setCostModeIndex(Math.max(0, nextCostModeIndex));
      const nextDirectCostItemIndex = costItems.findIndex(
        (item) => item.costItemId === next.directCostItemId,
      );
      setDirectCostItemIndex(Math.max(0, nextDirectCostItemIndex));
      setError(undefined);
    }
  }, [categories, costItems, initialValues, visible]);
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
    if (nextValues.costMode === 'direct' && !nextValues.directCostItemId) {
      setError('Selecione o item de custo direto.');
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
                <Divider />
                <Text modifiers={[roundedFont({ size: 15, weight: 'semibold' })]}>
                  Custo do produto
                </Text>
                <Picker
                  label="Modo de custo"
                  onSelectionChange={(selection) => {
                    const index = Number(selection);
                    const costMode = COST_MODE_OPTIONS[index]?.value ?? '';
                    setCostModeIndex(index);
                    setValues((current) => ({
                      ...current,
                      costMode,
                      directCostItemId: costMode === 'direct' ? current.directCostItemId : '',
                    }));
                  }}
                  selection={costModeIndex}
                  modifiers={[
                    pickerStyle('menu'),
                    ...(testModeEnabled || submitting ? [disabledModifier(true)] : []),
                  ]}
                >
                  {COST_MODE_OPTIONS.map((option, index) => (
                    <Text
                      key={option.value || 'without-cost'}
                      modifiers={[roundedFont({}), tag(index)]}
                    >
                      {option.label}
                    </Text>
                  ))}
                </Picker>
                {values.costMode === 'direct' ? (
                  <>
                    <Picker
                      label="Item de custo"
                      onSelectionChange={(selection) => {
                        const index = Number(selection);
                        setDirectCostItemIndex(index);
                        update('directCostItemId', costItems[index]?.costItemId ?? '');
                      }}
                      selection={directCostItemIndex}
                      modifiers={[
                        pickerStyle('menu'),
                        ...(testModeEnabled || submitting || !costItems.length
                          ? [disabledModifier(true)]
                          : []),
                      ]}
                    >
                      {costItems.map((item, index) => (
                        <Text key={item.costItemId} modifiers={[roundedFont({}), tag(index)]}>
                          {`${item.label} (${item.unit})`}
                        </Text>
                      ))}
                    </Picker>
                    <Text modifiers={[roundedFont({ textStyle: 'footnote' })]}>
                      Custo direto usa o histórico do item selecionado em Custos.
                    </Text>
                    {!costItems.length ? (
                      <Text modifiers={[roundedFont({ textStyle: 'footnote' })]}>
                        Cadastre um item de custo em Custos antes de vincular o custo direto.
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {values.costMode === 'composition' ? (
                  <Text modifiers={[roundedFont({ textStyle: 'footnote' })]}>
                    Composição usa os componentes e seus custos históricos.
                  </Text>
                ) : null}
                {values.costMode === 'composition' && onOpenComposition && costItems.length ? (
                  <Button
                    label="Editar composição"
                    modifiers={[
                      buttonStyle('glass'),
                      ...(testModeEnabled || submitting ? [disabledModifier(true)] : []),
                    ]}
                    onPress={onOpenComposition}
                  />
                ) : null}
                {values.costMode === 'composition' && !onOpenComposition && costItems.length ? (
                  <Text modifiers={[roundedFont({ textStyle: 'footnote' })]}>
                    Salve o produto para criar a composição.
                  </Text>
                ) : null}
                {values.costMode === 'composition' && !costItems.length ? (
                  <Text modifiers={[roundedFont({ textStyle: 'footnote' })]}>
                    Cadastre itens de custo em Custos antes de criar uma composição.
                  </Text>
                ) : null}
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
