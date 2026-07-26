import NativeDialogExpo from './NativeDialog.expo';
import type { NativeDialogProps } from './NativeDialog.types';

export default function NativeDialogNative(props: NativeDialogProps) {
  return <NativeDialogExpo {...props} />;
}
