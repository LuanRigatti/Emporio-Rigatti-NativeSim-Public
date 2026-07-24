import { useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  ActionSheet,
  AppHeader,
  AppModal,
  AppText,
  Avatar,
  Badge,
  BottomSheet,
  Card,
  ClientCard,
  ClientSelector,
  ConfirmationDialog,
  CurrencyInput,
  DateInput,
  DeliveryCard,
  DestructiveButton,
  EmptyState,
  ErrorState,
  FilterBar,
  FinanceCard,
  FloatingActionButton,
  FormError,
  GroupedList,
  IconButton,
  Input,
  InlineError,
  LargeTitleHeader,
  ListItem,
  ListSeparator,
  Loading,
  LoadingOverlay,
  MetricCard,
  PaymentCard,
  PaymentMethodSelector,
  PrimaryButton,
  ProgressBar,
  QuantityInput,
  RouteStopCard,
  SearchBar,
  ScrollScreen,
  SecondaryButton,
  SegmentedControl,
  SelectableListItem,
  Section,
  SectionHeader,
  Skeleton,
  StatusChip,
  StatusSelector,
  SwipeAction,
  SwipeableListItem,
  SwitchField,
  TextButton,
  TimeInput,
  Toast,
} from '@/components';
import { useAppTheme, type ThemeMode } from '@/theme';
import type { PaymentMethod, StatusLabel } from '@/components/types';

const themeModes: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const statuses: readonly StatusLabel[] = [
  'Pago',
  'Não Pago',
  'Entregue',
  'Pendente',
  'Emitido',
  'A emitir',
];

export function DesignSystemShowcase() {
  const { theme, mode, setMode } = useAppTheme();
  const [input, setInput] = useState('Exemplo');
  const [currency, setCurrency] = useState('125,00');
  const [quantity, setQuantity] = useState('2');
  const [date, setDate] = useState('24/07/2026');
  const [time, setTime] = useState('09:30');
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<string | undefined>('Cliente demonstração');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>();
  const [status, setStatus] = useState<StatusLabel>('Pendente');
  const [toggle, setToggle] = useState(true);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const showLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 900);
  };

  return (
    <ScrollScreen
      contentContainerStyle={{
        paddingBottom: theme.layout.tabBarHeight + theme.layout.safeAreaMinimum,
      }}
    >
      <AppHeader
        title="Design System"
        rightAction={
          <IconButton
            accessibilityLabel="Mostrar toast"
            icon={
              <Ionicons
                color={theme.colors.primary}
                name="notifications-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => setToastVisible(true)}
          />
        }
      />
      <LargeTitleHeader subtitle="Componentes fundamentais" title="Showcase" />

      <Section title="Tema">
        <SegmentedControl options={themeModes} value={mode} onChange={setMode} />
      </Section>

      <Section title="Botões">
        <PrimaryButton label="Ação principal" onPress={() => setToastVisible(true)} fullWidth />
        <SecondaryButton label="Ação secundária" onPress={showLoading} fullWidth />
        <DestructiveButton
          label="Ação destrutiva"
          onPress={() => setConfirmVisible(true)}
          fullWidth
        />
        <TextButton label="Ação textual" onPress={() => setSheetVisible(true)} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <IconButton
            accessibilityLabel="Abrir modal"
            icon={
              <Ionicons
                color={theme.colors.primary}
                name="square-outline"
                size={theme.sizes.iconMedium}
              />
            }
            onPress={() => setModalVisible(true)}
          />
          <FloatingActionButton
            accessibilityLabel="Abrir opções"
            icon={
              <Ionicons color={theme.colors.textInverse} name="add" size={theme.sizes.iconMedium} />
            }
            label="Abrir opções"
            onPress={() => setActionSheetVisible(true)}
          />
        </View>
      </Section>

      <Section title="Formulários">
        <Input clearable label="Texto" onChangeText={setInput} value={input} />
        <SearchBar clearable onChangeText={setSearch} value={search} />
        <CurrencyInput label="Moeda" onChangeText={setCurrency} value={currency} />
        <QuantityInput label="Quantidade" onChangeText={setQuantity} value={quantity} />
        <DateInput
          label="Data"
          onClear={() => setDate('')}
          onPress={() => setDate('25/07/2026')}
          value={date}
        />
        <TimeInput label="Horário" onPress={() => setTime('10:00')} value={time} />
        <FilterBar
          filters={[
            { key: 'period', label: 'Este mês', active: true },
            { key: 'pending', label: 'Pendentes' },
          ]}
        />
        <ClientSelector
          onClear={() => setClient(undefined)}
          onPress={() => setClient('Cliente selecionado')}
          value={client}
        />
        <PaymentMethodSelector onChange={setPaymentMethod} value={paymentMethod} />
        <StatusSelector onChange={setStatus} options={statuses} value={status} />
        <SwitchField label="Ativar notificações" onValueChange={setToggle} value={toggle} />
        <FormError message="Exemplo de erro de formulário" />
      </Section>

      <Section title="Cards">
        <Card>
          <AppText variant="headline">Card base com tokens do tema</AppText>
        </Card>
        <MetricCard
          label="Entregas"
          subtitle="Resumo do dia"
          trend="up"
          trendLabel="12%"
          value="24"
        />
        <FinanceCard hidden label="Receita" value="R$ 1.250,00" />
        <DeliveryCard
          clientName="Cliente demonstração"
          dateLabel="Hoje"
          delivered={false}
          onPress={() => setToastVisible(true)}
          quantityLabel="2 baldes"
          status="Pendente"
          totalLabel="R$ 80,00"
        />
        <ClientCard
          avatar={<Avatar name="Cliente demonstração" />}
          address="Rua Principal, 100"
          name="Cliente demonstração"
          secondaryText="12 entregas"
        />
        <PaymentCard
          amountLabel="R$ 80,00"
          clientName="Cliente demonstração"
          onSettle={() => setPaymentMethod('Dinheiro')}
          status="Não Pago"
        />
        <RouteStopCard
          address="Rua Principal, 100"
          clientName="Cliente demonstração"
          distanceLabel="1,2 km"
          order={1}
          status="Entregue"
        />
      </Section>

      <Section title="Listas">
        <ListItem
          leading={
            <Ionicons
              color={theme.colors.primary}
              name="person-outline"
              size={theme.sizes.iconMedium}
            />
          }
          subtitle="Dados secundários"
          title="Item de lista"
          trailing={<Badge label="Novo" tone="info" />}
        />
        <ListSeparator inset />
        <SelectableListItem
          onSelect={() => setToggle(!toggle)}
          selected={toggle}
          title="Item selecionável"
        />
        <SwipeableListItem
          rightActions={<SwipeAction label="Arquivar" onPress={() => setToastVisible(true)} />}
        >
          <ListItem title="Item com ação lateral" />
        </SwipeableListItem>
        <GroupedList
          sections={[
            {
              key: 'group',
              title: 'Grupo',
              items: [
                <ListItem key="one" title="Primeiro item" />,
                <ListItem key="two" title="Segundo item" />,
              ],
            },
          ]}
        />
      </Section>

      <Section title="Feedback">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {statuses.map((item) => (
            <StatusChip key={item} status={item} />
          ))}
        </View>
        <Loading label="Carregando dados" />
        <Skeleton height={theme.spacing.lg} />
        <ProgressBar label="Progresso" progress={0.65} />
        <InlineError message="Mensagem de erro inline" />
        <EmptyState
          description="Quando não houver registros, esta mensagem será exibida."
          title="Nenhum registro"
        />
        <ErrorState
          description="Exemplo de falha recuperável."
          onRetry={showLoading}
          title="Não foi possível carregar"
        />
      </Section>

      <SectionHeader
        actionLabel="Ação"
        onActionPress={() => setToastVisible(true)}
        title="Seção independente"
      />
      <SecondaryButton label="Mostrar loading" loading={loading} onPress={showLoading} fullWidth />
      <LoadingOverlay label="Carregando" visible={loading} />
      <Toast
        message="Ação executada"
        onDismiss={() => setToastVisible(false)}
        visible={toastVisible}
      />
      <AppModal onRequestClose={() => setModalVisible(false)} title="Modal" visible={modalVisible}>
        <AppText>Conteúdo provisório do modal.</AppText>
        <PrimaryButton label="Fechar" onPress={() => setModalVisible(false)} fullWidth />
      </AppModal>
      <BottomSheet
        onClose={() => setSheetVisible(false)}
        title="Bottom sheet"
        visible={sheetVisible}
      >
        <AppText>Conteúdo provisório do bottom sheet.</AppText>
        <SecondaryButton label="Fechar" onPress={() => setSheetVisible(false)} fullWidth />
      </BottomSheet>
      <ConfirmationDialog
        confirmLabel="Confirmar"
        message="Esta é uma confirmação visual, sem regra de negócio."
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => setConfirmVisible(false)}
        title="Confirmar ação"
        visible={confirmVisible}
      />
      <ActionSheet
        onClose={() => setActionSheetVisible(false)}
        options={[
          { key: 'one', label: 'Primeira opção', onPress: () => setActionSheetVisible(false) },
          {
            key: 'two',
            label: 'Opção destrutiva',
            destructive: true,
            onPress: () => setActionSheetVisible(false),
          },
        ]}
        title="Ações"
        visible={actionSheetVisible}
      />
    </ScrollScreen>
  );
}
