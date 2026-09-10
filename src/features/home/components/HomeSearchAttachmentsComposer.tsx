// Ported from the chatgpt-attachments animation in:
// https://github.com/SchroederNathan/react-native-motion/tree/main/apps/expo/components/animations/chatgpt-attachments
import type { CameraType, FlashMode } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { CameraBar } from './chatgpt-attachments/camera/camera-bar';
import { CameraSheet, type CameraSheetHandle } from './chatgpt-attachments/camera/camera-sheet';
import { AttachmentFlight } from './chatgpt-attachments/composer/attachment-flight';
import { Composer } from './chatgpt-attachments/composer/composer';
import {
  DURATION,
  GRID,
  GUTTER,
  sheetTopFromComposerBottom,
} from './chatgpt-attachments/constants';
import { AttachmentMenu, type MenuAction } from './chatgpt-attachments/panel/attachment-menu';
import { AttachmentPanel } from './chatgpt-attachments/panel/attachment-panel';
import { LocalCalendar } from './chatgpt-attachments/panel/local-calendar';
import { PhotoGridBar } from './chatgpt-attachments/photos/photo-grid-bar';
import { PhotoGrid, type PhotoGridHandle } from './chatgpt-attachments/photos/photo-grid';
import { usePhotoLibrary, type LibraryPhoto } from './chatgpt-attachments/photos/use-photo-library';
import { SheetBar } from './chatgpt-attachments/panel/sheet-bar';
import { useAttachmentFlights } from './chatgpt-attachments/use-attachment-flights';
import { useAttachmentPanel } from './chatgpt-attachments/use-attachment-panel';
import { useSheetGeometry } from './chatgpt-attachments/use-sheet-geometry';

export interface HomeSearchAttachmentsComposerProps {
  value: string;
  placeholder: string;
  focusRequestKey: number;
  blurRequestKey: number;
  onChangeText: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  onSubmit: (value: string) => void;
}

export default function HomeSearchAttachmentsComposer({
  value,
  placeholder,
  focusRequestKey,
  blurRequestKey,
  onChangeText,
  onFocusChange,
  onSubmit,
}: HomeSearchAttachmentsComposerProps) {
  const { width, height, composerBottom, composerStyle, gridWidth, gridHeight } =
    useSheetGeometry();
  const { photos, status } = usePhotoLibrary();
  const inputRef = useRef<TextInput>(null);
  const gridRef = useRef<PhotoGridHandle>(null);
  const cameraRef = useRef<CameraSheetHandle>(null);

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const capturing = useRef(false);
  const [selected, setSelected] = useState<string[]>([]);
  const clearSelection = useCallback(() => setSelected([]), []);
  const panel = useAttachmentPanel({ onLeaveSheet: clearSelection });
  const {
    attachments,
    flights,
    isFlying,
    attach,
    strip,
    attachAndLeave,
    addAttachments,
    removeAttachment,
  } = useAttachmentFlights({
    collapsePanel: panel.collapseForLeave,
    resetPanel: panel.resetAfterLeave,
    onSettled: clearSelection,
  });

  const togglePhoto = useCallback((photo: LibraryPhoto) => {
    Haptics.selectionAsync();
    setSelected((previous) =>
      previous.includes(photo.id)
        ? previous.filter((id) => id !== photo.id)
        : [...previous, photo.id],
    );
  }, []);

  const confirmSelection = useCallback(() => {
    const picked = selected
      .map((id) => photos.find((photo) => photo.id === id))
      .filter((photo): photo is LibraryPhoto => !!photo)
      .filter((photo) => !attachments.some((existing) => existing.id === photo.id));
    if (!picked.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const gridTop = sheetTopFromComposerBottom(composerBottom.get());
    const cellSize = gridWidth / GRID.columns - GRID.gap;
    const fallback = {
      x: GUTTER + (gridWidth - cellSize) / 2,
      y: gridTop + (gridHeight - cellSize) / 2,
      w: cellSize,
      h: cellSize,
    };
    const base = attachments.length;
    attachAndLeave(
      picked.map((photo, index) => {
        const cell = gridRef.current?.measureCell(photo.id);
        return {
          photo,
          slot: base + index,
          from: cell ? { x: GUTTER + cell.x, y: gridTop + cell.y, w: cell.w, h: cell.h } : fallback,
        };
      }),
    );
  }, [attachAndLeave, attachments, composerBottom, gridHeight, gridWidth, photos, selected]);

  const capturePhoto = useCallback(async () => {
    if (capturing.current) return;
    capturing.current = true;
    try {
      const uri = await cameraRef.current?.takePicture();
      if (!uri) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const sheetTop = sheetTopFromComposerBottom(composerBottom.get());
      attachAndLeave([
        {
          photo: { id: uri, kind: 'photo' },
          slot: attachments.length,
          from: { x: GUTTER, y: sheetTop, w: gridWidth, h: gridHeight },
          fromRadius: GRID.panelRadius,
        },
      ]);
    } finally {
      capturing.current = false;
    }
  }, [attachAndLeave, attachments.length, composerBottom, gridHeight, gridWidth]);

  const pickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const files = result.assets.map((asset) => ({
        id: asset.uri,
        kind: 'file' as const,
        name: asset.name,
        mimeType: asset.mimeType,
      }));
      if (!files.length) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addAttachments(files);
      panel.dismiss();
    } catch {
      // Cancellations and provider errors leave the composer unchanged.
    }
  }, [addAttachments, panel]);

  const handleMenuAction = useCallback(
    (action: MenuAction) => {
      if (action === 'files') {
        void pickFiles();
        return;
      }
      panel.onMenuAction(action);
    },
    [pickFiles, panel],
  );

  const grid =
    panel.mode === 'camera' ? (
      <CameraSheet
        ref={cameraRef}
        width={gridWidth}
        height={gridHeight}
        facing={facing}
        flash={flash}
        lifting={isFlying}
      />
    ) : panel.mode === 'photos' ? (
      <PhotoGrid
        ref={gridRef}
        width={gridWidth}
        height={gridHeight}
        photos={photos}
        status={status}
        selected={selected}
        lifting={isFlying}
        onTogglePhoto={togglePhoto}
      />
    ) : panel.mode === 'date' ? (
      <LocalCalendar />
    ) : null;

  const flipCamera = useCallback(() => {
    Haptics.selectionAsync();
    setFacing((previous) => (previous === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback(() => {
    Haptics.selectionAsync();
    setFlash((previous) => (previous === 'off' ? 'on' : 'off'));
  }, []);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View style={[styles.bottom, composerStyle]}>
        <Composer
          ref={inputRef}
          attachments={attachments}
          strip={strip}
          plusOut={panel.plusOut}
          pendingIds={flights.map((flight) => flight.photo.id)}
          value={value}
          placeholder={placeholder}
          focusRequestKey={focusRequestKey}
          blurRequestKey={blurRequestKey}
          onChangeText={onChangeText}
          onFocusChange={onFocusChange}
          onSubmit={onSubmit}
          onPlusPress={panel.onPlusPress}
          onRemove={removeAttachment}
        />
      </Animated.View>

      <OverKeyboardView visible={panel.mode !== 'closed'}>
        {panel.mode !== 'closed' ? (
          <View pointerEvents={isFlying ? 'none' : 'box-none'} style={StyleSheet.absoluteFill}>
            <Pressable
              accessibilityLabel="Fechar menu de anexos"
              onPress={panel.dismiss}
              style={StyleSheet.absoluteFill}
            />
            <AttachmentPanel
              screenHeight={height}
              gridWidth={gridWidth}
              gridHeight={gridHeight}
              interactive={isFlying ? 'none' : panel.mode === 'menu' ? 'menu' : 'grid'}
              glass={!panel.closing}
              glassDuration={DURATION.panel / 1000}
              open={panel.open}
              morph={panel.morph}
              menuOpacity={panel.menuOpacity}
              gridOpacity={panel.gridOpacity}
              blur={panel.blur}
              composerBottom={composerBottom}
              menu={<AttachmentMenu onSelect={handleMenuAction} />}
              grid={grid}
            />

            {panel.sheet === 'camera' ? (
              <CameraBar
                width={gridWidth}
                active={panel.mode === 'camera' && !isFlying}
                fade={panel.gridOpacity}
                flash={flash}
                onBack={panel.backToMenu}
                onCapture={capturePhoto}
                onFlip={flipCamera}
                onToggleFlash={toggleFlash}
              />
            ) : panel.sheet === 'date' ? (
              <SheetBar
                width={gridWidth}
                active={panel.mode === 'date' && !isFlying}
                fade={panel.gridOpacity}
                onBack={panel.backToMenu}
              >
                <View />
              </SheetBar>
            ) : (
              <PhotoGridBar
                width={gridWidth}
                selected={selected}
                active={panel.mode === 'photos' && !isFlying}
                fade={panel.gridOpacity}
                onBack={panel.backToMenu}
                onConfirm={confirmSelection}
              />
            )}

            <AttachmentFlight
              flights={flights}
              screenWidth={width}
              attach={attach}
              strip={strip}
              composerBottom={composerBottom}
            />
          </View>
        ) : null}
      </OverKeyboardView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
