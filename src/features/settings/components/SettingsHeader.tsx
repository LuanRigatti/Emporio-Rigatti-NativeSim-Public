import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export type SettingsHeaderProps = {
  title: string;
};

export function SettingsHeader({ title }: SettingsHeaderProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.title3, { color: theme.colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
});
