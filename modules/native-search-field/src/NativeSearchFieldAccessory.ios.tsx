import { requireNativeView } from 'expo';
import { forwardRef, type ComponentType, type Ref } from 'react';

import type {
  NativeSearchFieldAccessoryProps,
  NativeSearchFieldAccessoryRef,
} from './NativeSearchFieldAccessory.types';

type NativeTextEvent = { nativeEvent: { value: string } };
type NativeFocusEvent = { nativeEvent: { value: boolean } };

type NativeSearchFieldAccessoryNativeProps = Omit<
  NativeSearchFieldAccessoryProps,
  'onChangeText' | 'onFocusChange' | 'onPressHelp' | 'onSubmit' | 'ref'
> & {
  onFocusChange?: (event: NativeFocusEvent) => void;
  onPressHelp?: () => void;
  onSubmit?: (event: NativeTextEvent) => void;
  onTextChange?: (event: NativeTextEvent) => void;
  ref?: Ref<NativeSearchFieldAccessoryRef>;
};

const NativeView = requireNativeView(
  'NativeSearchField',
  'NativeSearchFieldView',
) as ComponentType<NativeSearchFieldAccessoryNativeProps>;

const NativeSearchFieldAccessory = forwardRef<
  NativeSearchFieldAccessoryRef,
  NativeSearchFieldAccessoryProps
>(function NativeSearchFieldAccessory(
  {
    onChangeText,
    onFocusChange,
    onPressHelp,
    onSubmit,
    style,
    ...props
  },
  ref,
) {
  return (
    <NativeView
      {...props}
      ref={ref}
      style={[{ minHeight: 52, width: '100%' }, style]}
      onFocusChange={(event) => onFocusChange?.(event.nativeEvent.value)}
      onPressHelp={onPressHelp}
      onSubmit={(event) => onSubmit?.(event.nativeEvent.value)}
      onTextChange={(event) => onChangeText(event.nativeEvent.value)}
    />
  );
});

export default NativeSearchFieldAccessory;
