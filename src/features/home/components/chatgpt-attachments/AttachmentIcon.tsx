import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type AttachmentIconName =
  | 'arrow-up'
  | 'audio-lines'
  | 'camera'
  | 'camera-flip'
  | 'chevron-left'
  | 'close'
  | 'document-text'
  | 'ellipsis'
  | 'flash'
  | 'flash-off'
  | 'mic'
  | 'paperclip'
  | 'photos'
  | 'plus';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * The source animation uses its own nano-icons font. This app already ships
 * Ionicons, so the port keeps the source's icon roles while using the
 * existing, already-loaded icon set instead of adding another font/plugin.
 */
const ICONS: Record<AttachmentIconName, IoniconName> = {
  'arrow-up': 'arrow-up',
  'audio-lines': 'mic-outline',
  camera: 'camera-outline',
  'camera-flip': 'camera-reverse-outline',
  'chevron-left': 'chevron-back',
  close: 'close',
  'document-text': 'document-text-outline',
  ellipsis: 'ellipsis-horizontal',
  flash: 'flash-outline',
  'flash-off': 'flash-off-outline',
  mic: 'mic-outline',
  paperclip: 'attach-outline',
  photos: 'images-outline',
  plus: 'add',
};

export function AttachmentIcon({
  name,
  size,
  color,
}: {
  name: AttachmentIconName;
  size: number;
  color: string;
}) {
  return <Ionicons color={color} name={ICONS[name]} size={size} />;
}
