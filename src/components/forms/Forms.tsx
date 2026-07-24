import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';

import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { InlineError } from '../feedback';
import type {
  CommonAccessibilityProps,
  PaymentMethod,
  StatusLabel,
  ViewComponentStyle,
} from '../types';

type BaseFieldProps = CommonAccessibilityProps & {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

export type InputProps = Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'editable' | 'placeholderTextColor'
> &
  BaseFieldProps & {
    value: string;
    onChangeText: (value: string) => void;
    clearable?: boolean;
    onClear?: () => void;
    style?: ViewComponentStyle;
  };

export function Input({
  label,
  helperText,
  error,
  required = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  value,
  onChangeText,
  clearable = false,
  onClear,
  onFocus,
  onBlur,
  style,
  ...props
}: InputProps) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const labelText = required && label ? `${label} obrigatório` : label;

  return (
    <View style={style}>
      {label ? (
        <Text
          style={[
            theme.typography.subheadline,
            { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
          ]}
        >
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}
      <View style={styles.inputWrapper}>
        <TextInput
          {...props}
          accessibilityHint={accessibilityHint}
          accessibilityLabel={accessibilityLabel ?? labelText}
          accessibilityState={{ disabled }}
          editable={!disabled}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.textTertiary}
          style={[
            theme.typography.body,
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: error
                ? theme.colors.danger
                : focused
                  ? theme.colors.focus
                  : theme.colors.borderStrong,
              borderRadius: theme.radius.md,
              borderWidth: focused ? theme.borders.width.focus : theme.borders.width.thin,
              color: theme.colors.textPrimary,
              minHeight: theme.sizes.inputHeight,
              opacity: disabled ? theme.opacities.disabled : 1,
              paddingHorizontal: theme.spacing.md,
            },
            clearable && value ? { paddingRight: theme.sizes.touchTargetMinimum } : undefined,
          ]}
          value={value}
        />
        {clearable && value ? (
          <Pressable
            accessibilityLabel="Limpar campo"
            accessibilityRole="button"
            disabled={disabled}
            onPress={onClear}
            style={[
              styles.clearButton,
              {
                minHeight: theme.sizes.touchTargetMinimum,
                minWidth: theme.sizes.touchTargetMinimum,
              },
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
      {helperText && !error ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
      <InlineError message={error} />
    </View>
  );
}

export type CurrencyInputProps = Omit<InputProps, 'keyboardType'>;

export function CurrencyInput(props: CurrencyInputProps) {
  return <Input {...props} keyboardType="decimal-pad" />;
}

export type QuantityInputProps = Omit<InputProps, 'keyboardType'>;

export function QuantityInput(props: QuantityInputProps) {
  return <Input {...props} keyboardType="number-pad" />;
}

export type DateInputProps = BaseFieldProps &
  CommonAccessibilityProps & {
    value?: string;
    placeholder?: string;
    onPress?: () => void;
    onClear?: () => void;
    iconName?: 'calendar-outline' | 'time-outline';
    style?: ViewComponentStyle;
  };

export function DateInput({
  label,
  helperText,
  error,
  required = false,
  disabled = false,
  value,
  placeholder = 'Selecionar data',
  onPress,
  onClear,
  iconName = 'calendar-outline',
  accessibilityLabel,
  accessibilityHint,
  style,
}: DateInputProps) {
  const { theme } = useAppTheme();
  return (
    <View style={style}>
      {label ? (
        <Text
          style={[
            theme.typography.subheadline,
            { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
          ]}
        >
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}
      <View
        style={[
          styles.dateInput,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
            borderRadius: theme.radius.md,
            minHeight: theme.sizes.inputHeight,
            opacity: disabled ? theme.opacities.disabled : 1,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            triggerSelectionHaptic();
            onPress?.();
          }}
          style={({ pressed }) => [
            styles.selectorButton,
            pressed ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
          ]}
        >
          <Text
            style={[
              theme.typography.body,
              { color: value ? theme.colors.textPrimary : theme.colors.textTertiary },
            ]}
          >
            {value || placeholder}
          </Text>
          {!value ? (
            <Ionicons
              color={theme.colors.textTertiary}
              name={iconName}
              size={theme.sizes.iconMedium}
            />
          ) : null}
        </Pressable>
        {value && onClear ? (
          <Pressable
            accessibilityLabel="Limpar data"
            accessibilityRole="button"
            onPress={onClear}
            style={[
              styles.trailingIcon,
              {
                minHeight: theme.sizes.touchTargetMinimum,
                minWidth: theme.sizes.touchTargetMinimum,
              },
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
      {helperText && !error ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
      <InlineError message={error} />
    </View>
  );
}

export type SearchBarProps = Omit<InputProps, 'label' | 'keyboardType'> & {
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
};

export type TimeInputProps = DateInputProps;

export function TimeInput(props: TimeInputProps) {
  return (
    <DateInput
      {...props}
      iconName="time-outline"
      placeholder={props.placeholder ?? 'Selecionar horário'}
    />
  );
}

export function SearchBar({ onSubmitEditing, placeholder = 'Buscar', ...props }: SearchBarProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.searchWrapper,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.md,
          minHeight: theme.sizes.inputHeight,
          paddingHorizontal: theme.spacing.sm,
        },
      ]}
    >
      <Ionicons color={theme.colors.textTertiary} name="search" size={theme.sizes.iconMedium} />
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? 'Buscar'}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          theme.typography.body,
          styles.searchInput,
          { color: theme.colors.textPrimary, paddingHorizontal: theme.spacing.xs },
        ]}
      />
      {props.value && props.onClear ? (
        <Pressable
          accessibilityLabel="Limpar busca"
          accessibilityRole="button"
          onPress={props.onClear}
          style={styles.clearButton}
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

export type FilterOption = { key: string; label: string; active?: boolean };
export type FilterBarProps = {
  filters: readonly FilterOption[];
  onPress?: () => void;
  onRemove?: (key: string) => void;
  style?: ViewComponentStyle;
};

export function FilterBar({ filters, onPress, onRemove, style }: FilterBarProps) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.filterBar, style]}>
      <Pressable
        accessibilityLabel="Abrir filtros"
        accessibilityRole="button"
        onPress={onPress}
        style={[
          styles.filterButton,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: theme.radius.pill,
            minHeight: theme.sizes.touchTargetMinimum,
            paddingHorizontal: theme.spacing.sm,
          },
        ]}
      >
        <Ionicons color={theme.colors.primary} name="filter-outline" size={theme.sizes.iconSmall} />
        <Text
          style={[
            theme.typography.subheadline,
            { color: theme.colors.primary, marginLeft: theme.spacing.xs },
          ]}
        >
          Filtros
        </Text>
      </Pressable>
      {filters
        .filter((filter) => filter.active !== false)
        .map((filter) => (
          <Pressable
            accessibilityLabel={`Remover filtro ${filter.label}`}
            accessibilityRole="button"
            key={filter.key}
            onPress={() => onRemove?.(filter.key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: theme.colors.brand,
                borderRadius: theme.radius.pill,
                marginLeft: theme.spacing.xs,
                minHeight: theme.sizes.touchTargetMinimum,
                paddingHorizontal: theme.spacing.sm,
                gap: theme.spacing.xxs,
              },
            ]}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>
              {filter.label}
            </Text>
            <Ionicons
              color={theme.colors.textSecondary}
              name="close"
              size={theme.sizes.iconSmall}
            />
          </Pressable>
        ))}
    </View>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string };
export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  style?: ViewComponentStyle;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  style,
}: SegmentedControlProps<T>) {
  const { theme } = useAppTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segmented,
        {
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: theme.radius.pill,
          opacity: disabled ? theme.opacities.disabled : 1,
          padding: theme.spacing.xxs,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            key={option.value}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(option.value);
            }}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderRadius: theme.radius.pill,
                minHeight: theme.sizes.touchTargetMinimum,
                paddingHorizontal: theme.spacing.xs,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.subheadline,
                { color: selected ? theme.colors.textPrimary : theme.colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type ClientSelectorProps = BaseFieldProps &
  CommonAccessibilityProps & {
    value?: string;
    placeholder?: string;
    onPress?: () => void;
    onClear?: () => void;
    style?: ViewComponentStyle;
  };

export function ClientSelector({
  label = 'Cliente',
  value,
  placeholder = 'Selecionar cliente',
  error,
  helperText,
  required,
  disabled,
  onPress,
  onClear,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ClientSelectorProps) {
  const { theme } = useAppTheme();
  return (
    <View style={style}>
      <Text
        style={[
          theme.typography.subheadline,
          { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
        ]}
      >
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[
          styles.dateInput,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
            borderRadius: theme.radius.md,
            minHeight: theme.sizes.inputHeight,
            opacity: disabled ? theme.opacities.disabled : 1,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            triggerSelectionHaptic();
            onPress?.();
          }}
          style={({ pressed }) => [
            styles.selectorButton,
            pressed ? { backgroundColor: theme.colors.backgroundSecondary } : undefined,
          ]}
        >
          <Text
            style={[
              theme.typography.body,
              { color: value ? theme.colors.textPrimary : theme.colors.textTertiary },
            ]}
          >
            {value || placeholder}
          </Text>
          {!value ? (
            <Ionicons
              color={theme.colors.textTertiary}
              name="chevron-forward"
              size={theme.sizes.iconMedium}
            />
          ) : null}
        </Pressable>
        {value && onClear ? (
          <Pressable
            accessibilityLabel="Limpar cliente"
            accessibilityRole="button"
            onPress={onClear}
            style={[
              styles.trailingIcon,
              {
                minHeight: theme.sizes.touchTargetMinimum,
                minWidth: theme.sizes.touchTargetMinimum,
              },
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
      {helperText && !error ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
      <InlineError message={error} />
    </View>
  );
}

export type PaymentMethodSelectorProps = BaseFieldProps &
  CommonAccessibilityProps & {
    value?: PaymentMethod;
    onChange: (method: PaymentMethod) => void;
    style?: ViewComponentStyle;
  };

export function PaymentMethodSelector({
  label = 'Método de pagamento',
  value,
  onChange,
  error,
  helperText,
  required = true,
  disabled = false,
  accessibilityLabel,
  style,
}: PaymentMethodSelectorProps) {
  const { theme } = useAppTheme();
  const methods: readonly PaymentMethod[] = ['Dinheiro', 'Pix'];
  return (
    <View style={style}>
      <Text
        style={[
          theme.typography.subheadline,
          { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
        ]}
      >
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={[styles.choiceRow, { gap: theme.spacing.xs }]}>
        {methods.map((method) => {
          const selected = value === method;
          return (
            <Pressable
              accessibilityLabel={method}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={method}
              onPress={() => {
                triggerSelectionHaptic();
                onChange(method);
              }}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? theme.colors.brand : theme.colors.surface,
                  borderColor: selected ? theme.colors.brandStrong : theme.colors.borderStrong,
                  borderRadius: theme.radius.md,
                  minHeight: theme.sizes.inputHeight,
                  opacity: disabled ? theme.opacities.disabled : 1,
                  paddingHorizontal: theme.spacing.sm,
                },
              ]}
            >
              <Ionicons
                color={selected ? theme.colors.primary : theme.colors.textTertiary}
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={theme.sizes.iconMedium}
              />
              <Text
                style={[
                  theme.typography.callout,
                  { color: theme.colors.textPrimary, marginLeft: theme.spacing.xs },
                ]}
              >
                {method}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {helperText && !error ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
      <InlineError message={error} />
    </View>
  );
}

export type StatusSelectorProps = BaseFieldProps & {
  value?: StatusLabel;
  options?: readonly StatusLabel[];
  onChange: (status: StatusLabel) => void;
  style?: ViewComponentStyle;
};

export function StatusSelector({
  label = 'Status',
  value,
  options = ['Pago', 'Não Pago', 'Entregue', 'Pendente', 'Emitido', 'A emitir'],
  onChange,
  error,
  helperText,
  required,
  disabled,
  style,
}: StatusSelectorProps) {
  const { theme } = useAppTheme();
  return (
    <View style={style}>
      <Text
        style={[
          theme.typography.subheadline,
          { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
        ]}
      >
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={[styles.wrap, { gap: theme.spacing.xs }]}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={option}
              onPress={() => {
                triggerSelectionHaptic();
                onChange(option);
              }}
              style={[
                styles.statusOption,
                {
                  backgroundColor: selected
                    ? theme.colors.backgroundSecondary
                    : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
                  borderRadius: theme.radius.pill,
                  opacity: disabled ? theme.opacities.disabled : 1,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.caption,
                  { color: selected ? theme.colors.primary : theme.colors.textSecondary },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {helperText && !error ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
      <InlineError message={error} />
    </View>
  );
}

export type SwitchFieldProps = BaseFieldProps &
  CommonAccessibilityProps & {
    value: boolean;
    onValueChange: (value: boolean) => void;
    style?: ViewComponentStyle;
  };

export function SwitchField({
  label,
  helperText,
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: SwitchFieldProps) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.switchField, { minHeight: theme.sizes.touchTargetMinimum }, style]}>
      <View style={styles.content}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{label}</Text>
        {helperText ? (
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
            ]}
          >
            {helperText}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled}
        onValueChange={(nextValue) => {
          triggerSelectionHaptic();
          onValueChange(nextValue);
        }}
        thumbColor={theme.colors.surface}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
        value={value}
      />
    </View>
  );
}

export type FormFieldProps = BaseFieldProps & { children: ReactNode; style?: ViewComponentStyle };

export function FormField({ label, helperText, error, required, children, style }: FormFieldProps) {
  const { theme } = useAppTheme();
  return (
    <View style={style}>
      {label ? (
        <Text
          style={[
            theme.typography.subheadline,
            { color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
          ]}
        >
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}
      {children}
      {helperText && !error ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
      <InlineError message={error} />
    </View>
  );
}

export type FormErrorProps = { message?: string; style?: ViewComponentStyle };
export function FormError({ message, style }: FormErrorProps) {
  return <InlineError message={message} style={style} />;
}

const styles = StyleSheet.create({
  inputWrapper: { position: 'relative' },
  input: {},
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dateInput: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectorButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trailingIcon: { alignItems: 'center', justifyContent: 'center' },
  searchWrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 0,
  },
  searchInput: { flex: 1, paddingVertical: 0 },
  filterBar: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  filterButton: { alignItems: 'center', flexDirection: 'row' },
  filterChip: { alignItems: 'center', flexDirection: 'row' },
  segmented: { flexDirection: 'row' },
  segment: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  choiceRow: { flexDirection: 'row' },
  choice: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  statusOption: { borderWidth: 1 },
  switchField: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: { flex: 1 },
});
