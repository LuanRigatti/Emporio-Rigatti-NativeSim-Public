import { View } from 'react-native';

import type { NativeSearchFieldAccessoryProps } from './NativeSearchFieldAccessory.types';

export default function NativeSearchFieldAccessory({ style }: NativeSearchFieldAccessoryProps) {
  return <View style={[{ minHeight: 52, width: '100%' }, style]} />;
}
