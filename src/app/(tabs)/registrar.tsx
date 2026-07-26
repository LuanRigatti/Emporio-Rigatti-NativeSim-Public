import { StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function PrototypeRegistrar() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';

  return (
    <View style={[styles.screen, { backgroundColor: dark ? '#000000' : '#FFFFFF' }]}>
      <Text style={[styles.title, { color: dark ? '#FFFFFF' : '#000000' }]}>Registrar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '600' },
});
