import { createElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { getNativeCapabilities } from '@/platform/nativeCapabilities';

import NativeDatePickerExpo from './NativeDatePicker.expo';
import type { NativeDatePickerProps } from './NativeDatePicker.types';

const COMPACT_DATE_PICKER_SLOT_HEIGHT = 34;
const COMPACT_DATE_PICKER_SLOT_WIDTH = 125;

export default function NativeDatePickerNative(props: NativeDatePickerProps) {
  const canUseExpoUI = getNativeCapabilities().canUseNativePicker;
  const NativeImplementation = canUseExpoUI
    ? require('./NativeDatePickerSwiftUI.ios').default // eslint-disable-line @typescript-eslint/no-require-imports
    : null;
  const isCompactNativePicker =
    Platform.OS === 'ios' && props.style === 'compact' && NativeImplementation;

  const nativePicker = NativeImplementation ? (
    createElement(NativeImplementation, props)
  ) : (
    <NativeDatePickerExpo {...props} />
  );

  return isCompactNativePicker ? (
    <View style={styles.compactSlot}>{nativePicker}</View>
  ) : (
    nativePicker
  );
}

const styles = StyleSheet.create({
  compactSlot: {
    alignItems: 'center',
    height: COMPACT_DATE_PICKER_SLOT_HEIGHT,
    justifyContent: 'center',
    width: COMPACT_DATE_PICKER_SLOT_WIDTH,
  },
});
