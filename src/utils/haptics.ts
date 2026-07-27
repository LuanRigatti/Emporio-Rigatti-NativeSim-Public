import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const TAB_HAPTIC_IMPACT_STYLE = Haptics.ImpactFeedbackStyle.Light;

export function triggerSelectionHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync().catch(() => undefined);
}

export function triggerLightImpactHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function triggerTabHaptic(): void {
  if (Platform.OS === 'web') return;

  void Haptics.impactAsync(TAB_HAPTIC_IMPACT_STYLE).catch(() => undefined);
}
