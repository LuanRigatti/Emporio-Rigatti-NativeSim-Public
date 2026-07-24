import { Image, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, typography } from '@/theme';

export type AvatarProps = ViewProps & {
  name?: string;
  imageUri?: string;
  size?: number;
};

export function Avatar({ name = '', imageUri, size = 40, style, ...props }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <View
      accessibilityLabel={name || 'Avatar'}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, style]}
      {...props}
    >
      {imageUri ? (
        <Image
          accessibilityLabel={name || 'Avatar'}
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text style={styles.initials}>{initials || '?'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.feedback.infoSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...typography.bodyEmphasized,
    color: colors.brand.primary,
  },
});
