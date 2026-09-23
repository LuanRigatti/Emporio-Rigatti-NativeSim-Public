import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Keyboard } from 'react-native';

import { useRetailOrderCatalog } from '@/hooks/useRetailOrderCatalog';
import { useRetailOrders } from '@/hooks/useRetailOrders';
import type { RetailClient, RetailOrderCreateInput, RetailProduct } from '@/types/data';
import { formatPtBrDate, todayIso } from '@/utils/data';

import {
  buildRetailOrderCreateInput,
  buildRetailOrderWriteData,
  calculateRetailOrderDraftTotals,
  RetailOrderCostError,
} from '@/services/retail-orders';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import type {
  RetailOrderCatalogContext,
  RetailOrderDraftLine,
  RetailOrderDraftTotals,
  RetailOrderDraftValues,
} from '@/services/retail-orders';

export type RetailOrderFlowStep = 'client' | 'details' | 'products' | 'summary';

export type RetailOrderFlowContextValue = {
  activeClients: readonly RetailClient[];
  activeProducts: readonly RetailProduct[];
  canContinueProducts: boolean;
  categoriesById: ReadonlyMap<string, string>;
  catalogError?: string;
  catalogLoading: boolean;
  clearError: () => void;
  dismissSuccess: () => void;
  draft: RetailOrderDraftValues;
  draftTotals: RetailOrderDraftTotals | null;
  draftTotalsError?: string;
  error?: string;
  handleAddProduct: (productId?: string) => Promise<void>;
  handleClientChange: (clientId: string) => void;
  prepareOrder: () => Promise<{
    orderCatalog: RetailOrderCatalogContext;
    orderInput: RetailOrderCreateInput;
  }>;
  preparingOrder: boolean;
  productById: ReadonlyMap<string, RetailProduct>;
  productCostErrors: Readonly<Record<string, string>>;
  productOptions: readonly { label: string; value: string }[];
  removeLine: (productId: string) => void;
  selectedClient?: RetailClient;
  selectedProductId: string;
  selectedProductLabel: string;
  setSelectedProductId: (productId: string) => void;
  submitOrder: () => Promise<void>;
  submitting: boolean;
  successVisible: boolean;
  updateDraft: <K extends keyof RetailOrderDraftValues>(
    key: K,
    value: RetailOrderDraftValues[K],
  ) => void;
  updateLineQuantity: (productId: string, quantity: string) => void;
  validateProducts: () => Promise<boolean>;
  validatingProductId: string | null;
};

const RetailOrderFlowContext = createContext<RetailOrderFlowContextValue | null>(null);

function createInitialDraft(): RetailOrderDraftValues {
  const isoDate = todayIso();
  return {
    clientId: '',
    deliveryAddressSnapshot: '',
    deliveryCost: '0,00',
    deliveryDate: isoDate,
    deliveryFee: '0,00',
    discount: '0,00',
    lineItems: [],
    occasion: '',
    notes: '',
    orderDate: isoDate,
    recipient: '',
  };
}

function formatInputMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatCostError(
  error: unknown,
  product?: RetailProduct,
  orderCatalog?: RetailOrderCatalogContext,
): string {
  if (error instanceof RetailOrderCostError) {
    const { resolution } = error;
    if (resolution.reason === 'missing_cost_mode') {
      return 'Configure o modo de custo deste produto no Catálogo Varejo.';
    }
    if (resolution.reason === 'missing_direct_cost_item') {
      return 'Selecione o item de custo direto no Catálogo Varejo.';
    }
    if (resolution.reason === 'direct_cost_item_not_found') {
      return 'O item de custo direto configurado não foi encontrado em Custos. Selecione um item de custo válido no Catálogo Varejo.';
    }
    if (resolution.reason === 'no_cost_before_date') {
      const costItem = product?.directCostItemId
        ? orderCatalog?.costItems.find((item) => item.costItemId === product.directCostItemId)
        : undefined;
      const itemLabel = costItem?.name;
      const dateLabel = formatPtBrDate(resolution.referenceDate);
      return itemLabel
        ? `Não há custo histórico válido para ${itemLabel} em ${dateLabel}. Cadastre uma entrada em Custos com data igual ou anterior à data do pedido.`
        : `Não há custo histórico válido em ${dateLabel}. Cadastre uma entrada em Custos com data igual ou anterior à data do pedido.`;
    }
    return resolution.message;
  }
  return formatError(error, 'Não foi possível validar o custo deste produto.');
}

function validationDraftForProduct(
  draft: RetailOrderDraftValues,
  productId: string,
): RetailOrderDraftValues {
  return {
    ...draft,
    deliveryCost: '0,00',
    deliveryFee: '0,00',
    discount: '0,00',
    lineItems: [{ productId, quantity: '1' }],
  };
}

export function RetailOrderFlowProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const catalog = useRetailOrderCatalog();
  const { create } = useRetailOrders();
  const [draft, setDraft] = useState<RetailOrderDraftValues>(createInitialDraft);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [deliveryAddressEdited, setDeliveryAddressEdited] = useState(false);
  const [deliveryFeeEdited, setDeliveryFeeEdited] = useState(false);
  const [validatingProductId, setValidatingProductId] = useState<string | null>(null);
  const [preparingOrder, setPreparingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [productCostErrors, setProductCostErrors] = useState<Record<string, string>>({});
  const [successVisible, setSuccessVisible] = useState(false);
  const validationGeneration = useRef(0);
  const submittingRef = useRef(false);

  const activeClients = catalog.clients.filter((client) => client.active);
  const activeProducts = catalog.products.filter((product) => product.active);
  const activeProductIds = useMemo(
    () => catalog.products.filter((product) => product.active).map((product) => product.productId),
    [catalog.products],
  );
  const { prefetchForOrder } = catalog;
  const categoriesById = useMemo(
    () => new Map(catalog.categories.map((category) => [category.categoryId, category.label])),
    [catalog.categories],
  );
  const selectedClient = activeClients.find((client) => client.clientId === draft.clientId);
  const productById = useMemo(
    () => new Map(activeProducts.map((product) => [product.productId, product])),
    [activeProducts],
  );
  const productOptions = useMemo(
    () => [
      { label: 'Selecionar', value: '' },
      ...activeProducts.map((product) => {
        const details = [
          categoriesById.get(product.categoryId) ?? product.categoryName,
          product.variant,
          product.flavor,
          product.packageSize,
        ]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(' · ');
        return {
          label: `${product.productName}${details ? ` · ${details}` : ''}`,
          value: product.productId,
        };
      }),
    ],
    [activeProducts, categoriesById],
  );
  const selectedProductLabel =
    productOptions.find((option) => option.value === selectedProductId)?.label ?? 'Selecionar';
  const draftTotalsResult = useMemo<{
    error?: string;
    totals: RetailOrderDraftTotals | null;
  }>(() => {
    try {
      return {
        totals: calculateRetailOrderDraftTotals({
          deliveryFee: draft.deliveryFee,
          discount: draft.discount,
          lineItems: draft.lineItems,
          products: activeProducts,
        }),
      };
    } catch (totalsError) {
      return {
        error: formatError(totalsError, 'Revise os produtos, desconto e entrega do pedido.'),
        totals: null,
      };
    }
  }, [activeProducts, draft.deliveryFee, draft.discount, draft.lineItems]);
  const draftTotals = draftTotalsResult.totals;
  const draftTotalsError = draftTotalsResult.error;
  const hasValidLineItems = useMemo(() => {
    try {
      calculateRetailOrderDraftTotals({
        deliveryFee: '0,00',
        discount: '0,00',
        lineItems: draft.lineItems,
        products: activeProducts,
      });
      return true;
    } catch {
      return false;
    }
  }, [activeProducts, draft.lineItems]);
  const hasCostErrors = draft.lineItems.some((line) => Boolean(productCostErrors[line.productId]));
  const canContinueProducts =
    draft.lineItems.length > 0 &&
    hasValidLineItems &&
    !hasCostErrors &&
    !validatingProductId &&
    !preparingOrder &&
    !submitting;

  useEffect(() => {
    if (!pathname.endsWith('/produtos') || !activeProductIds.length) return;
    void prefetchForOrder(activeProductIds, draft.orderDate);
  }, [activeProductIds, draft.orderDate, pathname, prefetchForOrder]);

  const updateDraft = useCallback(
    <K extends keyof RetailOrderDraftValues>(key: K, value: RetailOrderDraftValues[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setError(undefined);
    },
    [],
  );

  const handleClientChange = useCallback(
    (clientId: string) => {
      const client = activeClients.find((candidate) => candidate.clientId === clientId);
      if (!client) return;
      setDraft((current) => ({
        ...current,
        clientId,
        ...(deliveryAddressEdited ? {} : { deliveryAddressSnapshot: client.address ?? '' }),
        ...(deliveryFeeEdited
          ? {}
          : { deliveryFee: formatInputMoney(client.defaultDeliveryFee ?? 0) }),
      }));
      setError(undefined);
    },
    [activeClients, deliveryAddressEdited, deliveryFeeEdited],
  );

  const handleAddProduct = useCallback(
    async (productId = selectedProductId) => {
      if (submitting || preparingOrder || validatingProductId) return;
      if (!productId) {
        setError('Selecione um produto para adicionar.');
        return;
      }
      const product = productById.get(productId);
      if (!product) {
        setError('O produto selecionado não está mais disponível.');
        return;
      }
      triggerNativeButtonHaptic('light');
      setSelectedProductId(productId);
      const existing = draft.lineItems.find((line) => line.productId === productId);
      let nextLineItems: RetailOrderDraftLine[];
      if (!existing) {
        nextLineItems = [...draft.lineItems, { productId, quantity: '1' }];
      } else {
        const nextQuantity = Number(existing.quantity.replace(',', '.'));
        if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
          setError(`A quantidade de ${product.productName} deve ser maior que zero.`);
          return;
        }
        nextLineItems = draft.lineItems.map((line) =>
          line.productId === productId
            ? { ...line, quantity: String(nextQuantity + 1) }
            : { ...line },
        );
      }
      setDraft((current) => ({ ...current, lineItems: nextLineItems }));
      setSelectedProductId('');
      setProductCostErrors((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setError(undefined);
      const generation = ++validationGeneration.current;
      setValidatingProductId(productId);
      let orderCatalog: RetailOrderCatalogContext | undefined;
      try {
        orderCatalog = await catalog.prepareForOrder([productId], {
          referenceDate: draft.orderDate,
          refresh: false,
        });
        const orderInput = buildRetailOrderCreateInput(
          validationDraftForProduct(draft, productId),
          selectedClient,
          activeProducts,
        );
        buildRetailOrderWriteData('validation', orderInput, orderCatalog);
      } catch (validationError) {
        if (generation !== validationGeneration.current) return;
        if (validationError instanceof RetailOrderCostError) {
          setProductCostErrors((current) => ({
            ...current,
            [productId]: formatCostError(validationError, product, orderCatalog),
          }));
        } else {
          setError(formatError(validationError, 'Não foi possível validar o custo do produto.'));
        }
      } finally {
        if (generation === validationGeneration.current) setValidatingProductId(null);
      }
    },
    [
      activeProducts,
      catalog,
      draft,
      preparingOrder,
      productById,
      selectedClient,
      selectedProductId,
      submitting,
      validatingProductId,
    ],
  );

  const updateLineQuantity = useCallback((productId: string, quantity: string) => {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((line) =>
        line.productId === productId ? { ...line, quantity } : line,
      ),
    }));
    setError(undefined);
  }, []);

  const removeLine = useCallback((productId: string) => {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.filter((line) => line.productId !== productId),
    }));
    setProductCostErrors((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setError(undefined);
  }, []);

  const prepareOrder = useCallback(async () => {
    const orderInput = buildRetailOrderCreateInput(draft, selectedClient, activeProducts);
    const orderCatalog = await catalog.prepareForOrder(
      orderInput.lineItems.map((lineItem) => lineItem.productId),
      { referenceDate: draft.orderDate, refresh: true },
    );
    buildRetailOrderWriteData('validation', orderInput, orderCatalog);
    return { orderCatalog, orderInput };
  }, [activeProducts, catalog, draft, selectedClient]);

  const validateProducts = useCallback(async () => {
    if (!draft.lineItems.length) {
      setError('Adicione ao menos um produto ao pedido.');
      return false;
    }
    if (!hasValidLineItems) {
      setError('Revise as quantidades dos produtos antes de continuar.');
      return false;
    }
    setPreparingOrder(true);
    setError(undefined);
    try {
      const productIds = draft.lineItems.map((line) => line.productId);
      const orderCatalog = await catalog.prepareForOrder(productIds, {
        referenceDate: draft.orderDate,
        refresh: true,
      });
      const nextErrors: Record<string, string> = {};
      for (const productId of productIds) {
        try {
          const orderInput = buildRetailOrderCreateInput(
            validationDraftForProduct(draft, productId),
            selectedClient,
            activeProducts,
          );
          buildRetailOrderWriteData('validation', orderInput, orderCatalog);
        } catch (validationError) {
          if (validationError instanceof RetailOrderCostError) {
            nextErrors[productId] = formatCostError(
              validationError,
              activeProducts.find((product) => product.productId === productId),
              orderCatalog,
            );
          } else {
            throw validationError;
          }
        }
      }
      setProductCostErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        setError('Configure o custo dos produtos antes de continuar.');
        return false;
      }
      return true;
    } catch (validationError) {
      setError(formatError(validationError, 'Não foi possível validar os custos do pedido.'));
      return false;
    } finally {
      setPreparingOrder(false);
    }
  }, [activeProducts, catalog, draft, hasValidLineItems, selectedClient]);

  const resetFlow = useCallback(() => {
    validationGeneration.current += 1;
    setDraft(createInitialDraft());
    setSelectedProductId('');
    setDeliveryAddressEdited(false);
    setDeliveryFeeEdited(false);
    setValidatingProductId(null);
    setPreparingOrder(false);
    setError(undefined);
    setProductCostErrors({});
  }, []);

  useEffect(() => {
    const isRetailOrderRoute =
      pathname === '/registrar-pedido-varejo' || pathname.startsWith('/registrar-pedido-varejo/');
    if (!isRetailOrderRoute) resetFlow();
  }, [pathname, resetFlow]);

  const submitOrder = useCallback(async () => {
    if (submitting || submittingRef.current) return;
    try {
      if (!draftTotals) throw new Error('Revise os produtos, desconto e entrega do pedido.');
    } catch (validationError) {
      setError(formatError(validationError, 'Revise os dados do pedido.'));
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    setError(undefined);
    Keyboard.dismiss();
    try {
      const preparedOrder = await prepareOrder();
      await create(preparedOrder.orderInput, preparedOrder.orderCatalog);
      setSuccessVisible(true);
    } catch (submitError) {
      setError(formatError(submitError, 'Não foi possível criar o pedido.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [create, draftTotals, prepareOrder, submitting]);

  const dismissSuccess = useCallback(() => {
    setSuccessVisible(false);
  }, []);

  const clearError = useCallback(() => setError(undefined), []);

  const value = useMemo<RetailOrderFlowContextValue>(
    () => ({
      activeClients,
      activeProducts,
      canContinueProducts,
      categoriesById,
      catalogError: catalog.error,
      catalogLoading: catalog.loading,
      clearError,
      dismissSuccess,
      draft,
      draftTotals,
      draftTotalsError,
      error,
      handleAddProduct,
      handleClientChange,
      prepareOrder,
      preparingOrder,
      productById,
      productCostErrors,
      productOptions,
      removeLine,
      selectedClient,
      selectedProductId,
      selectedProductLabel,
      setSelectedProductId,
      submitOrder,
      submitting,
      successVisible,
      updateDraft,
      updateLineQuantity,
      validateProducts,
      validatingProductId,
    }),
    [
      activeClients,
      activeProducts,
      canContinueProducts,
      categoriesById,
      catalog.error,
      catalog.loading,
      clearError,
      dismissSuccess,
      draft,
      draftTotals,
      draftTotalsError,
      error,
      handleAddProduct,
      handleClientChange,
      prepareOrder,
      preparingOrder,
      productById,
      productCostErrors,
      productOptions,
      removeLine,
      selectedClient,
      selectedProductId,
      selectedProductLabel,
      submitOrder,
      submitting,
      successVisible,
      updateDraft,
      updateLineQuantity,
      validateProducts,
      validatingProductId,
    ],
  );

  return (
    <RetailOrderFlowContext.Provider value={value}>{children}</RetailOrderFlowContext.Provider>
  );
}

export function useRetailOrderFlow(): RetailOrderFlowContextValue {
  const context = useContext(RetailOrderFlowContext);
  if (!context) {
    throw new Error('useRetailOrderFlow deve ser usado dentro de RetailOrderFlowProvider.');
  }
  return context;
}
