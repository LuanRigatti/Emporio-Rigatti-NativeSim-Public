import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import { Fragment } from 'react';

import type { NativeOpenPaymentContextMenuHostViewProps } from './NativeContextMenuPreview.types';

const nativeHostModule = requireOptionalNativeModule('NativeOpenPaymentContextMenuHost');
const NativeHostView: ComponentType<NativeOpenPaymentContextMenuHostViewProps> | null =
  nativeHostModule ? requireNativeView('NativeOpenPaymentContextMenuHost') : null;

export const NativeOpenPaymentContextMenuHostView: ComponentType<
  NativeOpenPaymentContextMenuHostViewProps
> = ({ active, children, ...viewProps }) =>
  NativeHostView ? (
    <NativeHostView active={active} {...viewProps}>
      {children}
    </NativeHostView>
  ) : (
    <Fragment>{children}</Fragment>
  );
