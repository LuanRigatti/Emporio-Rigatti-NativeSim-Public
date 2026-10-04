import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/typography';
import { useAppTheme } from '@/theme';

type HomeModeTitleCompactRNProps = {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
};

export default function HomeModeTitleCompactRN({
  accessibilityLabel,
  label,
  onPress,
}: HomeModeTitleCompactRNProps) {
  const { theme } = useAppTheme();
  const compactTitleFontSize = theme.typography.headline.fontSize + 1;

  return (
    <Pressable
      accessibilityHint="Abre o seletor de modo"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={[styles.action, { minHeight: theme.sizes.touchTargetMinimum }]}
    >
      <AppText
        numberOfLines={1}
        variant="headline"
        style={[styles.title, { fontSize: compactTitleFontSize }]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    lineHeight: 20,
  },
});
