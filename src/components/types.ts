import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type ViewComponentStyle = StyleProp<ViewStyle>;
export type TextComponentStyle = StyleProp<TextStyle>;

export type CommonAccessibilityProps = {
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export type ButtonSize = 'small' | 'medium' | 'large';
export type Trend = 'up' | 'down' | 'neutral';
export type FeedbackTone = 'success' | 'warning' | 'danger' | 'info';
export type PaymentMethod = 'Dinheiro' | 'Pix';
export type StatusLabel = 'Pago' | 'Não Pago' | 'Entregue' | 'Pendente' | 'Emitido' | 'A emitir';

export type ActionOption = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};
