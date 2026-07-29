import NativeGlassHeaderBackgroundFallback from './NativeGlassHeaderBackgroundFallback';
import type { NativeGlassHeaderBackgroundProps } from './NativeGlassHeader.types';

export default function NativeGlassHeaderBackgroundNative(props: NativeGlassHeaderBackgroundProps) {
  return <NativeGlassHeaderBackgroundFallback {...props} />;
}
