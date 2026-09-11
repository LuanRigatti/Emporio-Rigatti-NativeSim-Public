import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  NativeButton,
  NativeDatePicker,
  NativeDialog,
  NativeList,
  NativeMenu,
  NativePicker,
  NativeSegmentedControl,
  NativeSheet,
  NativeTextField,
  NativeToggle,
  type NativeListItem,
  type NativeMenuAction,
} from '@/components/native';
import { getNativeCapabilities } from '@/platform/nativeCapabilities';
import { useAppTheme } from '@/theme';

const options = ['Hoje', 'Mês', 'Tudo'];
const listItems: readonly NativeListItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Indicadores do período',
    systemImage: 'chart.bar',
  },
  {
    id: 'deliveries',
    title: 'Entregas',
    subtitle: 'Registros recentes',
    systemImage: 'shippingbox',
  },
  { id: 'clients', title: 'Clientes', subtitle: 'Cadastros ativos', systemImage: 'person.2' },
];

export default function NativeComponentsShowcase() {
  const { theme } = useAppTheme();
  const capabilities = getNativeCapabilities();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedPicker, setSelectedPicker] = useState<number | null>(0);
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [toggleValue, setToggleValue] = useState(false);
  const [textValue, setTextValue] = useState('');

  const menuActions: readonly NativeMenuAction[] = [
    {
      id: 'notifications',
      title: 'Notificações',
      systemImage: 'bell',
      onPress: () => setDialogVisible(true),
    },
    {
      id: 'privacy',
      title: 'Ocultar valores',
      systemImage: 'eye.slash',
      onPress: () => setToggleValue(true),
    },
    {
      id: 'logout',
      title: 'Sair da conta',
      systemImage: 'rectangle.portrait.and.arrow.right',
      destructive: true,
      onPress: () => setDialogVisible(true),
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { gap: theme.spacing.lg, padding: theme.spacing.lg }]}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
          Native Components
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          Showcase temporária para validação por ambiente.
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textTertiary }]}>
          Ambiente: {capabilities.environment}
        </Text>
        <Text style={[theme.typography.footnote, { color: theme.colors.textTertiary }]}>
          Expo UI: {capabilities.canUseExpoUI ? 'nativo' : 'fallback'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>Menu</Text>
        <NativeMenu
          accessibilityLabel="Abrir menu nativo"
          actions={menuActions}
          href="/dev/native-components-showcase"
          title="Opções"
        >
          <NativeButton
            fallbackIcon="ellipsis-horizontal"
            label="Abrir menu"
            onPress={() => undefined}
          />
        </NativeMenu>
      </View>

      <View style={styles.section}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Sheet e Dialog
        </Text>
        <View style={styles.row}>
          <NativeButton
            fallbackIcon="albums-outline"
            label="Sheet"
            onPress={() => setSheetVisible(true)}
          />
          <NativeButton
            fallbackIcon="information-circle-outline"
            label="Dialog"
            onPress={() => setDialogVisible(true)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Picker e Segmented Control
        </Text>
        <NativePicker
          label="Período"
          onSelectedIndexChange={setSelectedPicker}
          options={options}
          selectedIndex={selectedPicker}
        />
        <NativeSegmentedControl
          accessibilityLabel="Selecionar período"
          onSelectedIndexChange={setSelectedSegment}
          options={options}
          selectedIndex={selectedSegment}
        />
      </View>

      <View style={styles.section}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>Lista</Text>
        <NativeList
          accessibilityLabel="Lista de demonstração"
          items={listItems}
          onItemPress={() => setDialogVisible(true)}
          style={{ maxHeight: 220 }}
        />
      </View>

      <View style={styles.section}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Date Picker
        </Text>
        <NativeDatePicker
          accessibilityLabel="Selecionar data"
          mode="date"
          onChange={setSelectedDate}
          value={selectedDate}
        />
      </View>

      <View style={styles.section}>
        <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>
          Button, Toggle e Text Field
        </Text>
        <NativeButton
          fallbackIcon="checkmark"
          label="Ação nativa"
          onPress={() => setToggleValue((value) => !value)}
          systemImage="checkmark"
        />
        <NativeToggle
          label="Ativar demonstração"
          onValueChange={setToggleValue}
          value={toggleValue}
        />
        <NativeTextField
          label="Texto"
          onChangeText={setTextValue}
          placeholder="Digite algo"
          value={textValue}
        />
      </View>

      <NativeSheet onVisibleChange={setSheetVisible} title="Sheet nativa" visible={sheetVisible}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          Conteúdo temporário da sheet.
        </Text>
      </NativeSheet>
      <NativeDialog
        actions={[
          { id: 'cancel', title: 'Cancelar', onPress: () => undefined },
          { id: 'confirm', title: 'Confirmar', onPress: () => setDialogVisible(false) },
        ]}
        message="Este diálogo é apenas uma demonstração dos adaptadores nativos."
        onDismiss={() => setDialogVisible(false)}
        title="Demonstração"
        visible={dialogVisible}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  section: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
