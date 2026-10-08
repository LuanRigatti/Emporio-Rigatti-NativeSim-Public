import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { NativeContextMenuPreviewViewProps } from './NativeContextMenuPreview.types';

export const NativeContextMenuPreviewView: ComponentType<NativeContextMenuPreviewViewProps> =
  requireNativeView('NativeContextMenuPreview');
