import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

export type AppLogoProps = {
  size?: number;
};

export function AppLogo({ size = 92 }: AppLogoProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.brand,
          borderColor: theme.colors.glassBorder,
          borderRadius: theme.radius.xl,
          height: size,
          width: size,
        },
      ]}
    >
      <Ionicons color={theme.colors.brandStrong} name="water" size={theme.sizes.iconLarge + 8} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
