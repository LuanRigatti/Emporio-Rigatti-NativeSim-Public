import { StyleSheet, Text, View } from 'react-native';

import { NativeGlassHeader } from '@/components/layout';
import { NativeTextField } from '@/components/native';
import { GlassCard, PremiumScreen } from '@/components/premium';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useAppTheme } from '@/theme';

export function CompanyDataScreen() {
  const { theme } = useAppTheme();
  const { profile, updateField } = useCompanyProfile();
  const header = <NativeGlassHeader mode="transparent" title="Dados da Empresa" />;

  return (
    <PremiumScreen contentContainerStyle={styles.content} overlayHeader={header} progressiveBlur>
      <GlassCard style={[styles.card, { marginTop: theme.spacing.md }]}>
        <CompanyField
          label="Razão social"
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
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

function CompanyField({ label, ...props }: CompanyFieldProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <NativeTextField accessibilityLabel={label} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 16 },
  card: { gap: 20 },
  field: { gap: 8 },
});
