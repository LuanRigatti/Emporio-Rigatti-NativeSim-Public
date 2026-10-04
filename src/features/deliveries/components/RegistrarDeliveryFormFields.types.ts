export type RegistrarDeliveryQuantityDirection = 'down' | 'up';

export type RegistrarDeliveryFormFieldsProps = {
  date: Date;
  quantity: number;
  quantityDirection: RegistrarDeliveryQuantityDirection;
  totalValue: number;
  onDateChange: (date: Date) => void;
  onQuantityChange: (quantity: number, direction: RegistrarDeliveryQuantityDirection) => void;
};
