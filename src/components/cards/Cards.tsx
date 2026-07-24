import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme } from '@/theme';
import { triggerLightImpactHaptic } from '@/utils/haptics';

import { StatusChip } from '../feedback';
import type { StatusLabel, Trend, ViewComponentStyle } from '../types';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  elevated?: boolean;
  style?: ViewComponentStyle;
};

export function Card({ children, onPress, disabled = false, elevated = false, style }: CardProps) {
  const { theme } = useAppTheme();
  const handlePress = () => {
    triggerLightImpactHaptic();
    onPress?.();
  };
  const contentStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.separator,
      borderRadius: theme.radius.card,
      borderWidth: 1,
      padding: theme.spacing.lg,
      opacity: disabled ? theme.opacities.disabled : 1,
    },
    elevated ? theme.shadows.elevated : theme.shadows.card,
    style,
  ];

  if (!onPress) {
    return <View style={contentStyle}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        contentStyle,
        pressed && !disabled ? { opacity: theme.opacities.pressed } : undefined,
      ]}
    >
      {children}
    </Pressable>
  );
}

type ValueCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  comparison?: string;
  trend?: Trend;
  trendLabel?: string;
  hidden?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: ViewComponentStyle;
};

function TrendIndicator({ trend, label }: { trend: Trend; label?: string }) {
  const { theme } = useAppTheme();
  const iconName = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';
  const color =
    trend === 'up'
      ? theme.colors.success
      : trend === 'down'
        ? theme.colors.danger
        : theme.colors.textSecondary;

  return (
    <View style={[styles.trend, { gap: theme.spacing.xs, marginTop: theme.spacing.sm }]}>
      <Ionicons color={color} name={iconName} size={theme.sizes.iconSmall} />
      {label ? <Text style={[theme.typography.footnote, { color }]}>{label}</Text> : null}
    </View>
  );
}

function ValueCard({
  label,
  value,
  subtitle,
  comparison,
  trend,
  trendLabel,
  hidden = false,
  loading = false,
  icon,
  onPress,
  style,
}: ValueCardProps) {
  const { theme } = useAppTheme();
  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.cardHeader}>
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        {icon}
      </View>
      {loading ? (
        <View
          style={[
            styles.loadingLine,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: theme.radius.sm,
              height: theme.sizes.loadingLineHeight,
            },
          ]}
        />
      ) : (
        <View style={[styles.valueContainer, { marginTop: theme.spacing.xs }]}>
          <Text
            accessibilityLabel={hidden ? 'Valor oculto' : value}
            style={[
              theme.typography.metricMedium,
              {
                color: theme.colors.textPrimary,
                minWidth: hidden ? theme.sizes.hiddenValueWidth : undefined,
              },
            ]}
          >
            {hidden ? '••••' : value}
          </Text>
        </View>
      )}
      {subtitle ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
      {trend ? <TrendIndicator label={trendLabel ?? comparison} trend={trend} /> : null}
    </Card>
  );
}

export type MetricCardProps = ValueCardProps;

export function MetricCard(props: MetricCardProps) {
  return <ValueCard {...props} />;
}

export type FinanceCardProps = ValueCardProps;

export function FinanceCard(props: FinanceCardProps) {
  return <ValueCard {...props} />;
}

export type DeliveryCardProps = {
  clientName: string;
  dateLabel: string;
  quantityLabel: string;
  totalLabel: string;
  status: StatusLabel;
  delivered: boolean;
  onPress?: () => void;
  onPrimaryAction?: () => void;
  hiddenValue?: boolean;
  loading?: boolean;
  style?: ViewComponentStyle;
};

export function DeliveryCard({
  clientName,
  dateLabel,
  quantityLabel,
  totalLabel,
  status,
  delivered,
  onPress,
  onPrimaryAction,
  hiddenValue = false,
  loading = false,
  style,
}: DeliveryCardProps) {
  const { theme } = useAppTheme();

  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.cardHeader}>
        <View style={styles.flexContent}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {clientName}
          </Text>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
            ]}
          >
            {dateLabel}
          </Text>
        </View>
        <StatusChip status={status} />
      </View>
      <View style={[styles.detailRow, { marginTop: theme.spacing.md }]}>
        <Text style={[theme.typography.subheadline, { color: theme.colors.textSecondary }]}>
          {quantityLabel}
        </Text>
        <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
          {hiddenValue ? '••••' : totalLabel}
        </Text>
      </View>
      <Text
        style={[
          theme.typography.footnote,
          {
            color: delivered ? theme.colors.delivered : theme.colors.pending,
            marginTop: theme.spacing.xs,
          },
        ]}
      >
        {delivered ? 'Entregue' : 'Pendente'}
      </Text>
      {loading ? (
        <View
          style={[
            styles.loadingLine,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: theme.radius.sm,
              height: theme.sizes.loadingLineHeight,
              marginTop: theme.spacing.md,
            },
          ]}
        />
      ) : onPrimaryAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPrimaryAction}
          style={[
            styles.inlineAction,
            { marginTop: theme.spacing.sm, minHeight: theme.sizes.touchTargetMinimum },
          ]}
        >
          <Text style={[theme.typography.headline, { color: theme.colors.primary }]}>
            Ver detalhes
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export type ClientCardProps = {
  name: string;
  address?: string;
  secondaryText?: string;
  avatar?: ReactNode;
  onPress?: () => void;
  loading?: boolean;
  style?: ViewComponentStyle;
};

export function ClientCard({
  name,
  address,
  secondaryText,
  avatar,
  onPress,
  loading = false,
  style,
}: ClientCardProps) {
  const { theme } = useAppTheme();

  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.cardHeader}>
        {avatar}
        <View style={[styles.flexContent, { marginLeft: avatar ? theme.spacing.sm : 0 }]}>
          {loading ? (
            <View
              style={[
                styles.loadingLine,
                {
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: theme.radius.sm,
                  height: theme.sizes.loadingLineHeight,
                },
              ]}
            />
          ) : (
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              {name}
            </Text>
          )}
          {address ? (
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
              ]}
            >
              {address}
            </Text>
          ) : null}
          {secondaryText ? (
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textTertiary, marginTop: theme.spacing.xxs },
              ]}
            >
              {secondaryText}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export type PaymentCardProps = {
  clientName: string;
  deliveryLabel?: string;
  amountLabel: string;
  dateLabel?: string;
  status: 'Pago' | 'Não Pago';
  methodLabel?: string;
  hiddenValue?: boolean;
  onPress?: () => void;
  onSettle?: () => void;
  loading?: boolean;
  style?: ViewComponentStyle;
};

export function PaymentCard({
  clientName,
  deliveryLabel,
  amountLabel,
  dateLabel,
  status,
  methodLabel,
  hiddenValue = false,
  onPress,
  onSettle,
  loading = false,
  style,
}: PaymentCardProps) {
  const { theme } = useAppTheme();

  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.cardHeader}>
        <View style={styles.flexContent}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {clientName}
          </Text>
          {deliveryLabel ? (
            <Text
              style={[
                theme.typography.footnote,
                { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
              ]}
            >
              {deliveryLabel}
            </Text>
          ) : null}
        </View>
        <StatusChip status={status} />
      </View>
      <View style={[styles.detailRow, { marginTop: theme.spacing.md }]}>
        <Text style={[theme.typography.currency, { color: theme.colors.textPrimary }]}>
          {hiddenValue ? '••••' : amountLabel}
        </Text>
        {dateLabel ? (
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
      {methodLabel ? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.textTertiary, marginTop: theme.spacing.xs },
          ]}
        >
          {methodLabel}
        </Text>
      ) : null}
      {loading ? (
        <View
          style={[
            styles.loadingLine,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: theme.radius.sm,
              height: theme.sizes.loadingLineHeight,
              marginTop: theme.spacing.md,
            },
          ]}
        />
      ) : onSettle ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSettle}
          style={{
            minHeight: theme.sizes.touchTargetMinimum,
            justifyContent: 'center',
            marginTop: theme.spacing.xs,
          }}
        >
          <Text style={[theme.typography.headline, { color: theme.colors.primary }]}>
            Quitar pagamento
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export type RouteStopCardProps = {
  order: number;
  clientName: string;
  address: string;
  distanceLabel?: string;
  durationLabel?: string;
  status: StatusLabel;
  onPress?: () => void;
  loading?: boolean;
  style?: ViewComponentStyle;
};

export function RouteStopCard({
  order,
  clientName,
  address,
  distanceLabel,
  durationLabel,
  status,
  onPress,
  loading = false,
  style,
}: RouteStopCardProps) {
  const { theme } = useAppTheme();

  return (
    <Card onPress={onPress} style={style}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.order,
            {
              backgroundColor: theme.colors.brand,
              borderRadius: theme.radius.pill,
              minHeight: theme.sizes.touchTargetMinimum,
              minWidth: theme.sizes.touchTargetMinimum,
            },
          ]}
        >
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {order}
          </Text>
        </View>
        <View style={[styles.flexContent, { marginLeft: theme.spacing.sm }]}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
            {clientName}
          </Text>
          <Text
            style={[
              theme.typography.footnote,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
            ]}
          >
            {address}
          </Text>
        </View>
        <StatusChip status={status} />
      </View>
      {loading ? (
        <View
          style={[
            styles.loadingLine,
            {
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: theme.radius.sm,
              height: theme.sizes.loadingLineHeight,
              marginTop: theme.spacing.md,
            },
          ]}
        />
      ) : distanceLabel || durationLabel ? (
        <View style={[styles.detailRow, { marginTop: theme.spacing.md }]}>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {distanceLabel}
          </Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
            {durationLabel}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  cardHeader: { alignItems: 'center', flexDirection: 'row' },
  flexContent: { flex: 1 },
  detailRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  trend: { alignItems: 'center', flexDirection: 'row' },
  loadingLine: { width: '45%' },
  valueContainer: { position: 'relative' },
  inlineAction: { justifyContent: 'center' },
  order: { alignItems: 'center', justifyContent: 'center' },
});
