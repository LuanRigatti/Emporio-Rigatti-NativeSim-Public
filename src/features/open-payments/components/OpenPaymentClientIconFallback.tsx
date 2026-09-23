import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

export default function OpenPaymentClientIconFallback({
  backgroundColor,
}: {
  backgroundColor?: string;
}) {
  const { resolvedMode, theme } = useAppTheme();
  const surface = backgroundColor ?? (resolvedMode === 'dark' ? '#2C2C2E' : '#F2F2F7');

  return (
    <View style={[styles.container, { backgroundColor: surface }]}>
      <Ionicons color={theme.colors.textPrimary} name="person-circle-outline" size={21} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
});
