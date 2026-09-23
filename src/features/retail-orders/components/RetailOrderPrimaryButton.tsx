import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { NativeButton } from '@/components/native';
import { useAppTheme } from '@/theme';

type RetailOrderPrimaryButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityValue?: string;
  disabled?: boolean;
  gateDisabledAction?: boolean;
  label: string;
  onPress: () => void;
};

export function RetailOrderPrimaryButton({
  accessibilityHint,
  accessibilityLabel,
  accessibilityValue,
  disabled,
  gateDisabledAction,
  label,
  onPress,
}: RetailOrderPrimaryButtonProps) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <NativeButton
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={accessibilityValue}
        backgroundColor={theme.colors.contrastSurface}
        color={theme.colors.contrastContent}
        controlSize="large"
        disabled={disabled}
        gateDisabledAction={gateDisabledAction}
        haptic="light"
        horizontalPadding={28}
        label={label}
        minHeight={58}
        minWidth={width * 0.84}
        onPress={onPress}
        variant="filled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
});
