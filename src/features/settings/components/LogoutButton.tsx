import { StyleSheet, View } from 'react-native';

import { NativeButton } from '@/components/native';
import { useAppTheme } from '@/theme';

export type LogoutButtonProps = {
  onPress: () => void;
};

export function LogoutButton({ onPress }: LogoutButtonProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: theme.colors.danger,
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <NativeButton
        accessibilityLabel="Sair da conta"
        destructive
        fallbackIcon="log-out-outline"
        label="Sair"
        onPress={onPress}
        systemImage="rectangle.portrait.and.arrow.right"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', borderWidth: 1, overflow: 'hidden' },
});
