import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export type HomeModeTitleProps = {
  compact?: boolean;
  label: string;
};

export default function HomeModeTitleFallback({ compact = false, label }: HomeModeTitleProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { marginLeft: -(theme.spacing.xxs * 2) }]}>
      <Text
        numberOfLines={1}
        style={[
          compact ? theme.typography.headline : theme.typography.largeTitle,
          styles.title,
          compact ? styles.compactTitle : undefined,
          { color: theme.colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start' },
  title: { fontFamily: 'System', fontSize: 37, fontWeight: '700' },
  compactTitle: { fontSize: 17, fontWeight: '600' },
});
