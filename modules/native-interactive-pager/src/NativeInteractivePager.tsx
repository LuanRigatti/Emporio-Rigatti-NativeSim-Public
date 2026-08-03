import type { ReactNode } from 'react';

import NativeInteractivePagerPage from './NativeInteractivePagerPage';
import NativeInteractivePagerView from './NativeInteractivePagerView';

export type NativeInteractivePagerSettledEvent = {
  nativeEvent: {
    page: number;
  };
};

export type NativeInteractivePagerProps = {
  children: ReactNode;
  initialPage?: number;
  requestedPage?: number;
  requestID?: number;
  onPageSettled?: (event: NativeInteractivePagerSettledEvent) => void;
};

export type NativeInteractivePagerPageProps = {
  page: number;
  children: ReactNode;
};

export function NativeInteractivePager({
  children,
  initialPage = 0,
  onPageSettled,
  requestID = 0,
  requestedPage,
}: NativeInteractivePagerProps) {
  return (
    <NativeInteractivePagerView
      initialPage={initialPage}
      onPageSettled={onPageSettled}
      requestID={requestID}
      requestedPage={requestedPage}
    >
      {children}
    </NativeInteractivePagerView>
  );
}

export function NativeInteractivePagerPageWrapper({
  children,
  page,
}: NativeInteractivePagerPageProps) {
  return <NativeInteractivePagerPage page={page}>{children}</NativeInteractivePagerPage>;
}
