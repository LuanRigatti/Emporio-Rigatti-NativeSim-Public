import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

type SystemLiquidGlassExperimentProps = {
  color: string;
  cornerRadius: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
  width: number;
};

export default function SystemLiquidGlassExperiment({
  color,
  onPress,
  style,
  title = 'Teste Liquid Glass',
}: SystemLiquidGlassExperimentProps) {
  return (
    <Text onPress={onPress} style={[styles.fallback, { color }, style]}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  fallback: {
    fontSize: 17,
    fontWeight: '600',
  },
});
