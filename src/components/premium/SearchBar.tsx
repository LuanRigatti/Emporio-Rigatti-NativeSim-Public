import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export type PremiumSearchBarProps = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholderTextColor'
> & {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SearchBar({
  accessibilityLabel = 'Buscar',
  onClear,
  onChangeText,
  onFocus,
  onBlur,
  placeholder = 'Buscar',
  style,
  value,
  ...props
}: PremiumSearchBarProps) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: focused ? theme.colors.focus : theme.colors.separator,
          borderRadius: theme.radius.pill,
          borderWidth: focused ? theme.borders.width.focus : theme.borders.width.thin,
          minHeight: theme.sizes.inputHeight,
          paddingHorizontal: theme.spacing.sm,
        },
        style,
      ]}
    >
      <Ionicons color={theme.colors.textTertiary} name="search" size={theme.sizes.iconMedium} />
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel}
        allowFontScaling
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onChangeText={onChangeText}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          theme.typography.body,
          styles.input,
          { color: theme.colors.textPrimary, paddingHorizontal: theme.spacing.xs },
        ]}
        value={value}
      />
      {value && onClear ? (
        <Pressable
          accessibilityLabel="Limpar busca"
          accessibilityRole="button"
          onPress={onClear}
          style={[
            styles.clear,
            { minHeight: theme.sizes.touchTargetMinimum, minWidth: theme.sizes.touchTargetMinimum },
          ]}
        >
          <Ionicons
            color={theme.colors.textTertiary}
            name="close-circle"
            size={theme.sizes.iconMedium}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row' },
  input: { flex: 1 },
  clear: { alignItems: 'center', justifyContent: 'center' },
});
