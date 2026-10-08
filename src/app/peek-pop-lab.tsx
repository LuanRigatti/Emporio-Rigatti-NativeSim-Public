import { useRouter } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import {
  NativePeekPopPreviewLabView,
  type NativeContextMenuActionEvent,
} from 'native-card-context-menu';

const preview = {
  title: 'Cliente Exemplo',
  subtitle: 'Cliente',
  leadingSystemImage: 'person.crop.circle.fill',
  summary: {
    label: 'Valor em aberto',
    value: 'R$ 306,00',
  },
  sections: [
    {
      title: 'Últimos pagamentos',
      rows: [
        { title: '30 Set 2026', subtitle: 'Pix', value: 'R$ 102,00' },
        { title: '23 Set 2026', subtitle: 'Dinheiro', value: 'R$ 99,60' },
        { title: '16 Set 2026', subtitle: 'Pix', value: 'R$ 50,00' },
      ],
    },
  ],
} as const;

const actions = [{ id: 'paid', title: 'Pago', systemImage: 'checkmark.circle' }] as const;

const interactiveViewerPreview = {
  title: 'Cliente Exemplo',
  subtitle: 'Cliente Varejo',
  leadingSystemImage: 'person.crop.circle.fill',
  summary: {
    label: 'Valor em aberto',
    value: 'R$ 306,00',
    subtitle: '3 baldes em aberto',
  },
  sections: [
    {
      title: 'Últimos pagamentos',
      rows: [
        { title: '30 Set 2026', subtitle: 'Pix', value: 'R$ 102,00' },
        { title: '23 Set 2026', subtitle: 'Dinheiro', value: 'R$ 99,60' },
        { title: '16 Set 2026', subtitle: 'Pix', value: 'R$ 50,00' },
      ],
    },
    {
      title: 'Informações adicionais',
      rows: [
        { title: 'Entrega', subtitle: 'Segunda, quarta e sexta' },
        { title: 'Endereço', subtitle: 'Rua de demonstração, 123' },
        { title: 'Forma de pagamento', value: 'Pix ou dinheiro' },
      ],
    },
  ],
} as const;

export default function PeekPopLabScreen() {
  const router = useRouter();

  const handleAction = ({ nativeEvent }: NativeContextMenuActionEvent) => {
    if (nativeEvent.actionId === 'paid') {
      Alert.alert('Demonstração', 'Nenhum dado real foi alterado.');
    }
  };

  return (
    <NativePeekPopPreviewLabView
      actions={actions}
      identifier="settings-peek-pop-sample-client"
      menuTitle="Cliente"
      onAction={handleAction}
      onClose={() => router.back()}
      preview={preview}
      secondaryCard={{
        title: 'Prévia → Painel expandido',
        identifier: 'settings-peek-pop-interactive-viewer',
        preview: interactiveViewerPreview,
        actions,
        menuTitle: 'Cliente',
        presentationStyle: 'interactiveViewer',
      }}
      style={styles.host}
    />
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
});
