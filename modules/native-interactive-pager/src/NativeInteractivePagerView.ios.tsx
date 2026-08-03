import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { NativeInteractivePagerProps } from './NativeInteractivePager';

const NativeInteractivePagerView: ComponentType<NativeInteractivePagerProps> = requireNativeView(
  'NativeInteractivePager',
  'NativeInteractivePagerView',
);

export default NativeInteractivePagerView;
