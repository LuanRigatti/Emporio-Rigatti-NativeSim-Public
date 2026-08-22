import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeSearchFieldExpo from './NativeSearchField.expo';
import NativeSearchPlaceholderShimmer from './NativeSearchPlaceholderShimmer';
import type { NativeSearchFieldProps } from './NativeSearchField.types';

export default function NativeSearchFieldNative(props: NativeSearchFieldProps) {
  const canUseExpoUI = getNativeCapabilities().canUseExpoUI;
  const [focused, setFocused] = useState(false);
  const { focusEntryKey = 0, onFocusChange, placeholder, ...nativeProps } = props;
  const handleFocusChange = useCallback(
    (nextFocused: boolean) => {
      setFocused(nextFocused);
      onFocusChange?.(nextFocused);
    },
    [onFocusChange],
  );
  const NativeImplementation = canUseExpoUI
    ? require('./NativeSearchFieldSwiftUI.ios').default // eslint-disable-line @typescript-eslint/no-require-imports
    : null;

  if (NativeImplementation) {
    return (
      <View style={{ position: 'relative', width: '100%' }}>
        <NativeImplementation {...nativeProps} onFocusChange={handleFocusChange} placeholder="" />
        <NativeSearchPlaceholderShimmer
          entryKey={focusEntryKey}
          placeholder={placeholder ?? 'Pesquisar'}
          visible={nativeProps.value.length === 0 && !focused}
        />
      </View>
    );
  }

  return canUseExpoUI ? (
    <View style={{ height: 36, width: '100%' }} />
  ) : (
    <NativeSearchFieldExpo {...props} />
  );
}
