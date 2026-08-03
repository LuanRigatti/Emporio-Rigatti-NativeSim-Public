import { View } from 'react-native';

import type { NativeLiquidGlassViewProps } from './NativeLiquidGlass';

/**
 * Non-iOS fallback for the module view. Liquid Glass is intentionally not
 * simulated with React Native visuals; iOS receives the native SwiftUI view.
 */
export default function NativeLiquidGlassViewFallback(_props: NativeLiquidGlassViewProps) {
  return <View accessible={false} />;
}
