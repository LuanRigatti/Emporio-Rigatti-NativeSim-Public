import { StyleSheet, Text, View } from 'react-native';

export default function SystemBottomSheetGlassContent() {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Bottom Sheet Liquid Glass</Text>
      <Text style={styles.description}>Arraste e toque para testar a interação nativa.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8, padding: 24 },
  description: { fontSize: 16 },
  title: { fontSize: 20, fontWeight: '600' },
});
