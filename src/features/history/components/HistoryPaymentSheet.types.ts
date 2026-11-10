import type { DeliveryPaymentSelection } from '@/types/data';

export type HistoryPaymentSheetProps = {
  amount: string;
  clientName: string;
  delivered: boolean;
  error?: string;
  isPaid: boolean;
  paymentSelection: DeliveryPaymentSelection;
  saving: boolean;
  visible: boolean;
  onCancel: () => void;
  onConfirm: (paymentReversalConfirmed: boolean) => void;
  onDeliveredChange: (delivered: boolean) => void;
  onPaymentSelectionChange: (selection: DeliveryPaymentSelection) => void;
};
