import { StyleSheet, Text, View } from 'react-native';

import { NativeSheet } from '../NativeSheet';
import { useAppTheme } from '@/theme';
import type { NativeBottomSheetProps } from './NativeBottomSheet.types';

export default function NativeBottomSheetFallback({
  items,
  content,
  onDismiss,
  onSelect,
  onVisibleChange,
  subtitle,
  title,
  visible,
}: NativeBottomSheetProps) {
  const { theme } = useAppTheme();
  const handleVisibleChange = (nextVisible: boolean) => {
    onVisibleChange(nextVisible);
    if (!nextVisible) onDismiss?.();
  };

  return (
    <NativeSheet
      onVisibleChange={handleVisibleChange}
      title={content ? undefined : title}
      visible={visible}
    >
      {content ?? (
        <View style={styles.content}>
          <Text style={[theme.typography.title2, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
          {items.map((item) => (
            <Text
              key={item.id}
              onPress={() => onSelect?.(item)}
              style={[theme.typography.body, { color: theme.colors.textPrimary }]}
            >
              {item.title}
            </Text>
          ))}
        </View>
      )}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
});
