import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/typography';
import { useAppTheme } from '@/theme';

type HomeModeTitleCompactRNProps = {
  label: string;
};

export default function HomeModeTitleCompactRN({ label }: HomeModeTitleCompactRNProps) {
  const { theme } = useAppTheme();
  const compactTitleFontSize = theme.typography.headline.fontSize + 1;

  return (
    <View style={[styles.container, { minHeight: theme.sizes.touchTargetMinimum }]}>
      <AppText
        numberOfLines={1}
        variant="headline"
        style={[styles.title, { fontSize: compactTitleFontSize }]}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    lineHeight: 20,
  },
});
