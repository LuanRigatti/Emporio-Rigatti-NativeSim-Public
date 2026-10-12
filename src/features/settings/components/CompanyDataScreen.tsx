import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeTextField } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useAppTheme } from '@/theme';

export function CompanyDataScreen() {
  const { theme } = useAppTheme();
  const { isHydrated, profile, updateField } = useCompanyProfile();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.max(0, windowWidth - theme.layout.screenHorizontalPadding * 2);
  const legalNameFieldWidth = Math.max(0, cardWidth - theme.spacing.lg * 2);
  const header = <NativeGlassHeader mode="transparent" title="Dados da Empresa" />;

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard
        style={[
          styles.card,
          {
            borderRadius: theme.radius.xl + theme.spacing.xxs,
            marginTop: theme.spacing.md,
            width: cardWidth,
          },
        ]}
      >
        <CompanyField
          label="Razão social"
          layoutWidth={legalNameFieldWidth}
          ready={isHydrated}
          multiline
          onChangeText={(value) => updateField('legalName', value)}
          placeholder="Informe a razão social"
          value={profile.legalName}
        />
        <CompanyField
          label="Nome fantasia"
          onChangeText={(value) => updateField('tradeName', value)}
          placeholder="Informe o nome fantasia"
          value={profile.tradeName}
        />
        <CompanyField
          label="CNPJ"
          keyboardType="number-pad"
          onChangeText={(value) => updateField('taxId', value)}
          placeholder="Informe o CNPJ"
          value={profile.taxId}
        />
        <CompanyField
          label="Endereço"
          onChangeText={(value) => updateField('address', value)}
          placeholder="Informe o endereço"
          value={profile.address}
        />
      </GlassCard>
    </PremiumScreen>
  );
}

type CompanyFieldProps = {
  label: string;
  keyboardType?: React.ComponentProps<typeof NativeTextField>['keyboardType'];
  layoutWidth?: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  ready?: boolean;
  value: string;
};

function CompanyField({ label, layoutWidth, ready = true, ...props }: CompanyFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.field, layoutWidth === undefined ? undefined : { width: layoutWidth }]}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      {ready ? <NativeTextField accessibilityLabel={label} {...props} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16 },
  card: { gap: 20 },
  field: { gap: 8 },
});
