import { View } from 'react-native';

import type { NativeInteractivePagerPageProps } from './NativeInteractivePager';

export default function NativeInteractivePagerPageFallback({
  children,
}: NativeInteractivePagerPageProps) {
  return <View>{children}</View>;
}
