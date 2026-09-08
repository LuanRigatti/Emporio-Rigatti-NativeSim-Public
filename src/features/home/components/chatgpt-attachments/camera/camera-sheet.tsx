import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { CAMERA, COLORS, PANEL_CONTENT } from '../constants';
import { SheetPlaceholder } from '../panel/sheet-placeholder';

export interface CameraSheetHandle {
  takePicture: () => Promise<string | null>;
}

interface CameraSheetProps {
  width: number;
  height: number;
  facing: CameraType;
  flash: FlashMode;
  lifting: boolean;
}

export const CameraSheet = forwardRef<CameraSheetHandle, CameraSheetProps>(function CameraSheet(
  { width, height, facing, flash, lifting },
  handle,
) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const ready = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useImperativeHandle(
    handle,
    () => ({
      takePicture: async () => {
        const camera = cameraRef.current;
        if (!camera || !ready.current) return null;
        try {
          const picture = await camera.takePictureAsync({
            quality: CAMERA.quality,
            shutterSound: false,
          });
          return picture?.uri ?? null;
        } catch {
          return null;
        }
      },
    }),
    [],
  );

  return (
    <View style={[styles.root, { width, height }]}>
      {permission?.granted ? (
        <CameraView
          ref={cameraRef}
          facing={facing}
          flash={flash}
          mirror={facing === 'front'}
          animateShutter={false}
          onCameraReady={() => {
            ready.current = true;
          }}
          style={[StyleSheet.absoluteFill, lifting && styles.lifted]}
        />
      ) : (
        <SheetPlaceholder>
          {permission && !permission.canAskAgain
            ? 'O acesso à câmera está desativado. Ative-o nos Ajustes para testar.'
            : 'Aguardando acesso à câmera…'}
        </SheetPlaceholder>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...PANEL_CONTENT,
    backgroundColor: COLORS.background,
  },
  lifted: { opacity: 0 },
});
