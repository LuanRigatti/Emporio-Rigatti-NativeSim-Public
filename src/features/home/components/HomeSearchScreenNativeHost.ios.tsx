import { Host } from '@expo/ui/swift-ui';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  mode?: 'content' | 'fill';
};

export default function HomeSearchScreenNativeHost({ children, mode = 'content' }: Props) {
  return mode === 'fill' ? (
    <Host style={{ flex: 1, width: '100%' }}>{children}</Host>
  ) : (
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      {children}
    </Host>
  );
}
