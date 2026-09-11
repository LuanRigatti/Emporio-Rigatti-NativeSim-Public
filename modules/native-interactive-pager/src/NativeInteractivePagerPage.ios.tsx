import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { NativeInteractivePagerPageProps } from './NativeInteractivePager';

const NativeInteractivePagerPage: ComponentType<NativeInteractivePagerPageProps> =
  requireNativeView('NativeInteractivePager', 'NativeInteractivePagerPage');

export default NativeInteractivePagerPage;
