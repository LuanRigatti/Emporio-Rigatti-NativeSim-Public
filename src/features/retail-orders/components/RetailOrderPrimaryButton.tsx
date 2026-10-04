import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { NativeButton } from '@/components/native';
import { useAppTheme } from '@/theme';
import type { NativeButtonProps } from '@/types/native-ui';

type RetailOrderPrimaryButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityValue?: string;
  disabled?: boolean;
  gateDisabledAction?: boolean;
  haptic?: NativeButtonProps['haptic'];
  label: string;
  onPress: () => void;
  preserveDisabledAppearance?: boolean;
};

export function RetailOrderPrimaryButton({
  accessibilityHint,
  accessibilityLabel,
  accessibilityValue,
  disabled,
  gateDisabledAction,
  haptic,
  label,
  onPress,
  preserveDisabledAppearance,
}: RetailOrderPrimaryButtonProps) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const actionGated = Boolean(disabled && preserveDisabledAppearance);

  return (
    <View style={styles.container}>
      <NativeButton
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={accessibilityValue}
        backgroundColor={theme.colors.contrastSurface}
        color={theme.colors.contrastContent}
        controlSize="large"
        disabled={actionGated ? false : disabled}
        gateDisabledAction={gateDisabledAction}
        haptic={actionGated ? 'none' : (haptic ?? 'light')}
        horizontalPadding={28}
        label={label}
        minHeight={58}
        minWidth={width * 0.84}
        onPress={() => {
          if (actionGated) return;
          onPress();
        }}
        variant="filled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
});
