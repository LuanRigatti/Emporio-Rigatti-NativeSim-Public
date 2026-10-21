import { Host, Text } from '@expo/ui/swift-ui';
import { font, foregroundColor } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import type { HomeModeTitleProps } from './HomeModeTitleFallback';

export default function HomeModeTitleSwiftUI({ compact = false, label }: HomeModeTitleProps) {
  const { theme } = useAppTheme();
  const isHomeLargeTitle = !compact;
  const titleFont = font({ size: compact ? 17 : 37, weight: compact ? 'semibold' : 'bold' });

  return (
    <View style={styles.container}>
      <Host matchContents ignoreSafeArea={isHomeLargeTitle ? 'container' : undefined}>
        <Text modifiers={[titleFont, foregroundColor(theme.colors.textPrimary)]}>{label}</Text>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start' },
});
