import { SplashFallback } from './SplashFallback';
import type { SplashVisualProps } from './SplashVisual.types';

export default function SplashVisualNative(props: SplashVisualProps) {
  return <SplashFallback {...props} />;
}
