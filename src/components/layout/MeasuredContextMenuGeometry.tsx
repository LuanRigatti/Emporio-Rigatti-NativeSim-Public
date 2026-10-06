import { useCallback, useState, type ReactNode } from 'react';
import { type LayoutChangeEvent, type ViewStyle } from 'react-native';

export type ContextMenuCardGeometryStyle = Pick<ViewStyle, 'height' | 'width'>;

export type MeasuredContextMenuGeometryValue = {
  onLayout: (event: LayoutChangeEvent) => void;
  previewFrameStyle: ContextMenuCardGeometryStyle | undefined;
  triggerWidthStyle: ContextMenuCardGeometryStyle | undefined;
};

type MeasuredContextMenuGeometryProps = {
  children: (geometry: MeasuredContextMenuGeometryValue) => ReactNode;
};

export function MeasuredContextMenuGeometry({ children }: MeasuredContextMenuGeometryProps) {
  const [size, setSize] = useState<{ height: number; width: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;

    setSize((current) =>
      current?.width === width && current.height === height ? current : { height, width },
    );
  }, []);

  return children({
    onLayout,
    previewFrameStyle: size ? { height: size.height, width: size.width } : undefined,
    triggerWidthStyle: size ? { width: size.width } : undefined,
  });
}
