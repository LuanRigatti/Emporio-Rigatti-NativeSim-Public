import { Image, StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme';

export type AppLogoProps = {
  size?: number;
  variant?: 'login' | 'splash';
};

const logoAssets = {
  login: {
    dark: require('../../../assets/branding/login-logo-dark.png'),
    light: require('../../../assets/branding/login-logo-light.png'),
  },
  splash: {
    dark: require('../../../assets/branding/splash-dark.png'),
    light: require('../../../assets/branding/splash-light.png'),
  },
} as const;

export function AppLogo({ size = 92, variant = 'login' }: AppLogoProps) {
  const { resolvedMode } = useAppTheme();
  const source = logoAssets[variant][resolvedMode === 'dark' ? 'dark' : 'light'];

  return (
    <Image
      resizeMode="contain"
      source={source}
      style={[styles.logo, { height: size, width: size }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: { alignSelf: 'center' },
});
