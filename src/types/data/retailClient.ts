export type FirestoreTimestamp = import('firebase/firestore').Timestamp;

export interface RetailClientReferral {
  hasReferral: boolean;
  sourceType?: string;
  referredByName?: string;
}

export interface RetailClient {
  clientId: string;
  name: string;
  normalizedName: string;
  phone?: string;
  address?: string;
  referral?: RetailClientReferral;
  defaultDeliveryFee?: number;
  active: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface RetailClientDraft {
  name: string;
  phone?: string;
  address?: string;
  referral?: RetailClientReferral;
  defaultDeliveryFee?: number;
  active?: boolean;
}

export interface RetailClientPatch {
  name?: string;
  phone?: string | null;
  address?: string | null;
  referral?: RetailClientReferral | null;
  defaultDeliveryFee?: number | null;
  active?: boolean;
}
