import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { NativeLiquidGlassViewProps } from './NativeLiquidGlass';

const NativeLiquidGlassView: ComponentType<NativeLiquidGlassViewProps> = requireNativeView(
  'NativeLiquidGlass',
  'NativeLiquidGlassView',
);

export default NativeLiquidGlassView;
