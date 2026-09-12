import { useRouter } from 'expo-router';
import { useState } from 'react';

import { NativeGlassHeader } from '@/components/layout';
import { NativeGlassBackButton } from '@/components/native';
import { FactoryPurchasesScreen } from '@/features/factory-purchases/components/FactoryPurchasesScreen';
import { getCurrentHistoryPeriod } from '@/features/history/utils/historyDateUtils';
import { useAppTheme } from '@/theme';

export function FactoryPurchaseRegisterRoute({
  nativeHeader = true,
}: { nativeHeader?: boolean } = {}) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const currentPeriod = getCurrentHistoryPeriod();
  const [selectedMonth] = useState(currentPeriod.month);
  const [selectedYear] = useState(currentPeriod.year);

  const header = (
    <NativeGlassHeader
      leftActions={
        nativeHeader ? undefined : (
          <NativeGlassBackButton
            accessibilityLabel="Voltar para Compras e Fábrica"
            color={theme.colors.textPrimary}
            containerSize={theme.sizes.touchTargetMinimum}
            onPress={() => router.back()}
            size={theme.sizes.iconMedium}
          />
        )
      }
      mode="transparent"
      title="Registrar compra"
    />
  );

  return (
    <FactoryPurchasesScreen
      header={header}
      mode="register"
      selectedMonth={selectedMonth}
      selectedYear={selectedYear}
    />
  );
}

export default FactoryPurchaseRegisterRoute;
