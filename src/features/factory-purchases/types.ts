export type PurchasePayment = {
  id: string;
  date: string;
  amount: number;
};

export type Purchase = {
  id: string;
  date: string;
  bucketQuantity: number;
  bucketUnitPrice: number;
  totalAmount: number;
  payments: PurchasePayment[];
};
