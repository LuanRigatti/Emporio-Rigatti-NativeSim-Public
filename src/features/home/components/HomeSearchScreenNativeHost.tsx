import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  mode?: 'content' | 'fill';
};

export default function HomeSearchScreenNativeHost({ children }: Props) {
  return children;
}
