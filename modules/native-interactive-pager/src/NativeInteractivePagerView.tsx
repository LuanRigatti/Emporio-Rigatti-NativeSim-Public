import { View } from 'react-native';

import type { NativeInteractivePagerProps } from './NativeInteractivePager';

export default function NativeInteractivePagerViewFallback({
  children,
}: NativeInteractivePagerProps) {
  return <View>{children}</View>;
}
