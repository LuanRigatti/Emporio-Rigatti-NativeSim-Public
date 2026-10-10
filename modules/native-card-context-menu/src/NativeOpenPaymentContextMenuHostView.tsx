import type { ComponentType } from 'react';
import { Fragment } from 'react';

import type { NativeOpenPaymentContextMenuHostViewProps } from './NativeContextMenuPreview.types';

export const NativeOpenPaymentContextMenuHostView: ComponentType<
  NativeOpenPaymentContextMenuHostViewProps
> = ({ active: _active, children, onExpandedPreviewChange: _onExpandedPreviewChange }) => (
  <Fragment>{children}</Fragment>
);
