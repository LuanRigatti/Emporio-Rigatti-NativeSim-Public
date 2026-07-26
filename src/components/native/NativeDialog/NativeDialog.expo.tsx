import { useEffect } from 'react';
import { Alert } from 'react-native';

import type { NativeDialogProps } from '@/types/native-ui';

export default function NativeDialogExpo({
  actions,
  message,
  onDismiss,
  title,
  visible,
}: NativeDialogProps) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    Alert.alert(
      title,
      message,
      actions.map((action) => ({
        text: action.title,
        style: action.destructive ? 'destructive' : 'default',
        onPress: action.onPress,
      })),
      { cancelable: true, onDismiss },
    );
  }, [actions, message, onDismiss, title, visible]);

  return null;
}
