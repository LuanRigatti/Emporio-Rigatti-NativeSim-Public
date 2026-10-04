import type { NativeRetailClientFormValues } from '@/components/native';
import type { RetailClientDraft } from '@/types/data';
import { normalizeMoney } from '@/utils/data';

export function retailClientFormToDraft(values: NativeRetailClientFormValues): RetailClientDraft {
  const feeText = values.defaultDeliveryFee.trim();
  const fee = feeText ? normalizeMoney(feeText) : undefined;
  if (feeText && (fee === undefined || fee < 0)) {
    throw new Error('A taxa padrão de entrega deve ser zero ou maior.');
  }

  return {
    address: values.address,
    defaultDeliveryFee: fee,
    name: values.name,
    phone: values.phone,
    referral: values.hasReferral
      ? {
          hasReferral: true,
          referredByName: values.referredByName,
          sourceType: values.sourceType,
        }
      : undefined,
  };
}
