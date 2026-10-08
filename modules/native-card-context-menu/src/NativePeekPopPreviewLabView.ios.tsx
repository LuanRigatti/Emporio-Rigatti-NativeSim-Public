import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { NativePeekPopPreviewLabViewProps } from './NativeContextMenuPreview.types';

export const NativePeekPopPreviewLabView: ComponentType<NativePeekPopPreviewLabViewProps> =
  requireNativeView('NativePeekPopPreviewLab');
