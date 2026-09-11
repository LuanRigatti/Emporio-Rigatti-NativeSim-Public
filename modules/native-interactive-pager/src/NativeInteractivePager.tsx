import type { ReactNode } from 'react';

import NativeInteractivePagerPage from './NativeInteractivePagerPage';
import NativeInteractivePagerView from './NativeInteractivePagerView';

export type NativeInteractivePagerSettledEvent = {
  nativeEvent: {
    page: number;
  };
};

export type NativeInteractivePagerGeometryEvent = {
  nativeEvent: {
    fillWidth: boolean;
    height: number;
    layer: 'pager' | 'tab-view' | 'page';
    page: number | null;
    selectedPage: number;
    width: number;
    x: number;
    y: number;
  };
};

export type NativeInteractivePagerProps = {
  children: ReactNode;
  fillWidth?: boolean;
  initialPage?: number;
  onGeometry?: (event: NativeInteractivePagerGeometryEvent) => void;
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
  fillWidth = false,
  initialPage = 0,
  onGeometry,
  onPageSettled,
  requestID = 0,
  requestedPage,
}: NativeInteractivePagerProps) {
  return (
    <NativeInteractivePagerView
      fillWidth={fillWidth}
      initialPage={initialPage}
      onGeometry={onGeometry}
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
