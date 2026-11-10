import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  BottomSheet,
  Button,
  ConfirmationDialog,
  Group,
  Host,
  HStack,
  Picker,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  background,
  clipShape,
  controlSize,
  disabled,
  font,
  frame,
  foregroundStyle,
  interactiveDismissDisabled,
  layoutPriority,
  lineLimit,
  multilineTextAlignment,
  padding,
  pickerStyle,
  presentationDragIndicator,
  presentationDetents,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useAppSafeAreaInsets } from '@/providers';
import { lightTheme, useAppTheme } from '@/theme';
import NativeSheetFieldIcon from '@/components/native/NativeSheetFieldIcon';

import type { HistoryPaymentSheetProps } from './HistoryPaymentSheet.types';

export default function HistoryPaymentSheet({
  amount,
  clientName,
  delivered,
  error,
  isPaid,
  paymentSelection,
  saving,
  visible,
  onCancel,
  onConfirm,
  onDeliveredChange,
  onPaymentSelectionChange,
}: HistoryPaymentSheetProps) {
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const clientAvatarBackgroundColor =
    resolvedMode === 'dark' ? lightTheme.colors.background : theme.colors.background;
  const clientAvatarIconColor =
    resolvedMode === 'dark' ? lightTheme.colors.textPrimary : theme.colors.textPrimary;
  const { fontScale, height: viewportHeight } = useWindowDimensions();
  const [showUndoConfirmation, setShowUndoConfirmation] = useState(false);
  const requiresReversalConfirmation = isPaid && paymentSelection === 'Não Pago';
  const requiresDeliveredForNewPayment = !isPaid && paymentSelection !== 'Não Pago' && !delivered;
  const validationMessage = requiresDeliveredForNewPayment
    ? 'Marque a entrega como Entregue para registrar o pagamento.'
    : undefined;
  const message = error ?? validationMessage;
  const pickerSpacerMaxHeight = theme.spacing.xxl - theme.spacing.xxs;
  const confirmButtonBackground = resolvedMode === 'dark' ? '#FFFFFF' : '#000000';
  const confirmButtonForeground = resolvedMode === 'dark' ? '#000000' : '#FFFFFF';
  const accessibleActionHeight = Math.max(56, theme.typography.headline.lineHeight * fontScale);
  const minimumHeaderHeight = Math.max(
    theme.typography.title2.lineHeight,
    theme.typography.title3.lineHeight * 2,
  );
  const pickerControlHeight = theme.sizes.touchTargetMinimum * fontScale;
  const pickerInterSectionSpacing =
    theme.spacing.sm + theme.typography.footnote.lineHeight * fontScale + theme.spacing.xxs;
  const minimumSheetContentHeight =
    theme.spacing.md +
    theme.spacing.xl +
    minimumHeaderHeight * fontScale +
    pickerControlHeight * 2 +
    pickerInterSectionSpacing +
    theme.spacing.md +
    theme.typography.footnote.lineHeight * fontScale +
    accessibleActionHeight +
    insets.bottom +
    theme.spacing.sm +
    theme.spacing.xl;
  const availableViewportHeight = Math.max(1, viewportHeight);
  const needsFullHeightAccessibilityDetent =
    minimumSheetContentHeight > availableViewportHeight * 0.95;
  const presentationDetentFraction = Math.max(
    0.45,
    minimumSheetContentHeight / availableViewportHeight,
  );
  const presentationDetentModifier = needsFullHeightAccessibilityDetent
    ? presentationDetents(['large'])
    : presentationDetentFraction === 0.45
      ? presentationDetents([{ fraction: 0.45 }])
      : presentationDetents([{ fraction: presentationDetentFraction }]);

  const confirmButton = (
    <Button
      onPress={() => {
        if (requiresReversalConfirmation) {
          setShowUndoConfirmation(true);
        } else {
          onConfirm(false);
        }
      }}
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity }),
        disabled(saving || requiresDeliveredForNewPayment),
        accessibilityLabel('Confirmar alterações de entrega e pagamento'),
      ]}
    >
      <ZStack
        modifiers={[
          frame({ maxWidth: Infinity }),
          frame({ minHeight: accessibleActionHeight }),
          background(confirmButtonBackground),
          clipShape('capsule'),
        ]}
      >
        <Text
          modifiers={[
            font({ textStyle: 'headline', weight: 'semibold' }),
            foregroundStyle(confirmButtonForeground),
            accessibilityLabel('Confirmar'),
          ]}
        >
          Confirmar
        </Text>
        {saving ? (
          <ProgressView
            modifiers={[
              tint(confirmButtonForeground),
              padding({ trailing: theme.spacing.md }),
              frame({ maxWidth: Infinity, alignment: 'trailing' }),
            ]}
          />
        ) : null}
      </ZStack>
    </Button>
  );

  return (
    <Host matchContents={{ vertical: true }}>
      <BottomSheet
        isPresented={visible}
        onDismiss={onCancel}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented) onCancel();
        }}
      >
        <Group
          modifiers={[
            presentationDetentModifier,
            presentationDragIndicator('visible'),
            interactiveDismissDisabled(saving),
          ]}
        >
          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[
              frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
            ]}
          >
            <VStack
              alignment="leading"
              spacing={0}
              modifiers={[
                padding({
                  horizontal: theme.spacing.lg,
                  top: theme.spacing.md + theme.spacing.xl,
                }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              <HStack
                alignment="center"
                spacing={theme.spacing.sm}
                modifiers={[frame({ maxWidth: Infinity })]}
              >
                <NativeSheetFieldIcon
                  accessibilityHidden
                  backgroundColor={clientAvatarBackgroundColor}
                  iconColor={clientAvatarIconColor}
                  systemImage="person.fill"
                />
                <Text
                  modifiers={[
                    font({ textStyle: 'title3', weight: 'semibold' }),
                    foregroundStyle(theme.colors.textPrimary),
                    lineLimit(2),
                    accessibilityLabel(clientName),
                    frame({ maxWidth: Infinity, alignment: 'leading' }),
                  ]}
                >
                  {clientName}
                </Text>
                <Text
                  modifiers={[
                    font({ textStyle: 'title2', weight: 'semibold' }),
                    foregroundStyle(theme.colors.textPrimary),
                    layoutPriority(1),
                    multilineTextAlignment('trailing'),
                  ]}
                >
                  {amount}
                </Text>
              </HStack>

              <Spacer
                minLength={0}
                modifiers={[frame({ maxHeight: pickerSpacerMaxHeight }), layoutPriority(1)]}
              />

              <VStack alignment="leading" spacing={0}>
                <VStack alignment="leading" spacing={pickerInterSectionSpacing}>
                  <Picker
                    selection={delivered ? 'Entregue' : 'Pendente'}
                    onSelectionChange={(selection) => {
                      if (selection === 'Entregue') onDeliveredChange(true);
                      if (selection === 'Pendente') onDeliveredChange(false);
                    }}
                    modifiers={[
                      pickerStyle('segmented'),
                      controlSize('large'),
                      accessibilityLabel('Status da entrega'),
                      disabled(saving),
                    ]}
                  >
                    <Text modifiers={[tag('Pendente')]}>Pendente</Text>
                    <Text modifiers={[tag('Entregue')]}>Entregue</Text>
                  </Picker>

                  <Picker
                    selection={paymentSelection}
                    onSelectionChange={(selection) => {
                      if (
                        selection === 'Não Pago' ||
                        selection === 'Pix' ||
                        selection === 'Dinheiro'
                      ) {
                        onPaymentSelectionChange(selection);
                      }
                    }}
                    modifiers={[
                      pickerStyle('segmented'),
                      controlSize('large'),
                      accessibilityLabel('Status do pagamento: Não pago, Pix ou Dinheiro'),
                      disabled(saving),
                    ]}
                  >
                    <Text modifiers={[tag('Não Pago')]}>Não pago</Text>
                    <Text modifiers={[tag('Pix')]}>Pix</Text>
                    <Text modifiers={[tag('Dinheiro')]}>Dinheiro</Text>
                  </Picker>
                </VStack>

                {message ? (
                  <Text
                    modifiers={[
                      padding({ top: theme.spacing.md }),
                      font({ textStyle: 'footnote' }),
                      foregroundStyle(theme.colors.danger),
                      lineLimit(1, { reservesSpace: true }),
                      accessibilityLabel(message),
                    ]}
                  >
                    {message}
                  </Text>
                ) : null}
              </VStack>
            </VStack>

            <Spacer minLength={0} />

            <VStack
              alignment="leading"
              spacing={0}
              modifiers={[
                padding({
                  horizontal: theme.spacing.lg,
                  bottom: insets.bottom + theme.spacing.sm,
                }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              <ConfirmationDialog
                isPresented={showUndoConfirmation}
                onIsPresentedChange={setShowUndoConfirmation}
                title="Desfazer pagamento?"
                titleVisibility="visible"
              >
                <ConfirmationDialog.Trigger>{confirmButton}</ConfirmationDialog.Trigger>
                <ConfirmationDialog.Message>
                  <Text>
                    O pagamento será removido e a entrega voltará para Recebimentos em aberto, se
                    continuar entregue.
                  </Text>
                </ConfirmationDialog.Message>
                <ConfirmationDialog.Actions>
                  <Button
                    label="Desfazer pagamento"
                    role="destructive"
                    onPress={() => {
                      setShowUndoConfirmation(false);
                      onConfirm(true);
                    }}
                    modifiers={[disabled(saving)]}
                  />
                  <Button
                    label="Cancelar"
                    role="cancel"
                    onPress={() => setShowUndoConfirmation(false)}
                  />
                </ConfirmationDialog.Actions>
              </ConfirmationDialog>
            </VStack>
          </VStack>
        </Group>
      </BottomSheet>
    </Host>
  );
}
