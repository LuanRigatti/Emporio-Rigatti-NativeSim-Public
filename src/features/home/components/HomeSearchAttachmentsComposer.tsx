// Ported from the chatgpt-attachments animation in:
// https://github.com/SchroederNathan/react-native-motion/tree/main/apps/expo/components/animations/chatgpt-attachments
import type { CameraType, FlashMode } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import { CameraBar } from './chatgpt-attachments/camera/camera-bar';
import { CameraSheet, type CameraSheetHandle } from './chatgpt-attachments/camera/camera-sheet';
import { AttachmentFlight } from './chatgpt-attachments/composer/attachment-flight';
import { Composer } from './chatgpt-attachments/composer/composer';
import {
  ATTACHMENT_CONTROL_GLASS_TINT,
  BOTTOM_BAR,
  COLORS,
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
import { Glass } from './chatgpt-attachments/glass';
import { localDateKey } from './chatgpt-attachments/local-date';

const CALENDAR_CONFIRM_BUTTON_WIDTH = 120;

export interface HomeSearchAttachmentsComposerProps {
  value: string;
  placeholder: string;
  focusRequestKey: number;
  blurRequestKey: number;
  onChangeText: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  onSubmit: (value: string, selectedDate?: string) => boolean;
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
  const [dateAttachmentState, setDateAttachmentState] = useState<{
    blurRequestKey: number;
    date: string;
  } | null>(null);
  const [calendarDateState, setCalendarDateState] = useState(() => ({
    blurRequestKey,
    date: localDateKey(new Date()),
  }));
  const selectedDate =
    dateAttachmentState?.blurRequestKey === blurRequestKey ? dateAttachmentState.date : null;
  const calendarSelectedDate =
    calendarDateState.blurRequestKey === blurRequestKey
      ? calendarDateState.date
      : localDateKey(new Date());
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
  const [holdMenuPendingIds, setHoldMenuPendingIds] = useState<string[]>([]);

  const attachHoldMenuPhoto = useCallback(
    (photo: LibraryPhoto) => {
      setHoldMenuPendingIds((current) =>
        current.includes(photo.id) ? current : [...current, photo.id],
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addAttachments([photo]);
    },
    [addAttachments],
  );

  const finishHoldMenuPhotoDock = useCallback((photoId: string) => {
    setHoldMenuPendingIds((current) => current.filter((id) => id !== photoId));
  }, []);

  const resetDateAttachment = useCallback(() => {
    setDateAttachmentState(null);
    setCalendarDateState({ blurRequestKey, date: localDateKey(new Date()) });
  }, [blurRequestKey]);

  const handleSubmit = useCallback(
    (text: string) => {
      const submitted = onSubmit(text, selectedDate ?? undefined);
      if (submitted) resetDateAttachment();
      return submitted;
    },
    [onSubmit, resetDateAttachment, selectedDate],
  );

  const confirmCalendarDate = useCallback(() => {
    setDateAttachmentState({ blurRequestKey, date: calendarSelectedDate });
    panel.dismiss();
  }, [blurRequestKey, calendarSelectedDate, panel]);

  const handleCalendarConfirmPress = useCallback(() => {
    triggerNativeButtonHaptic('selection');
    confirmCalendarDate();
  }, [confirmCalendarDate]);

  const updateCalendarSelectedDate = useCallback(
    (date: string) => setCalendarDateState({ blurRequestKey, date }),
    [blurRequestKey],
  );

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
      <LocalCalendar
        key={calendarSelectedDate}
        selectedDate={calendarSelectedDate}
        onSelectedDateChange={updateCalendarSelectedDate}
      />
    ) : null;

  const flipCamera = useCallback(() => {
    Haptics.selectionAsync();
    setFacing((previous) => (previous === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback(() => {
    Haptics.selectionAsync();
    setFlash((previous) => (previous === 'off' ? 'on' : 'off'));
  }, []);

  const isDateSheetActive = panel.sheet === 'date' && panel.mode === 'date' && !panel.closing;
  const isCameraSheetActive = panel.sheet === 'camera' && panel.mode === 'camera' && !panel.closing;
  const isPhotoSheetActive = panel.sheet === 'photos' && panel.mode === 'photos' && !panel.closing;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View style={[styles.bottom, composerStyle]}>
        <Composer
          ref={inputRef}
          attachments={attachments}
          recentPhotos={photos}
          strip={strip}
          plusOut={panel.plusOut}
          composerBottom={composerBottom}
          screenWidth={width}
          pendingIds={[...flights.map((flight) => flight.photo.id), ...holdMenuPendingIds]}
          holdMenuPendingIds={holdMenuPendingIds}
          value={value}
          placeholder={placeholder}
          focusRequestKey={focusRequestKey}
          blurRequestKey={blurRequestKey}
          onChangeText={onChangeText}
          onFocusChange={onFocusChange}
          onSubmit={handleSubmit}
          dateAttachment={selectedDate ?? undefined}
          onRemoveDateAttachment={resetDateAttachment}
          onPlusTap={panel.onPlusTap}
          holdMenuEnabled={panel.mode === 'closed' && !panel.closing && !panel.opening}
          onHoldPhotoSelect={attachHoldMenuPhoto}
          onHoldPhotoDockSettled={finishHoldMenuPhotoDock}
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

            {isCameraSheetActive ? (
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
            ) : null}

            {isDateSheetActive ? (
              <SheetBar
                width={gridWidth}
                active={panel.mode === 'date' && !isFlying}
                fade={panel.gridOpacity}
                onBack={panel.backToMenu}
              >
                <View
                  pointerEvents="box-none"
                  style={styles.calendarConfirmSlot}
                  testID="calendar-confirm-slot"
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Selecionar"
                    onPress={handleCalendarConfirmPress}
                    testID="calendar-confirm-action"
                  >
                    <Glass
                      testID="calendar-confirm-glass"
                      radius={BOTTOM_BAR.controlSize / 2}
                      active={panel.mode === 'date' && !isFlying}
                      duration={DURATION.crossfade / 1000}
                      tintColor={ATTACHMENT_CONTROL_GLASS_TINT}
                      fallbackTint={ATTACHMENT_CONTROL_GLASS_TINT}
                      style={styles.calendarConfirmGlass}
                    >
                      <Text numberOfLines={1} style={styles.calendarConfirmLabel}>
                        Selecionar
                      </Text>
                    </Glass>
                  </Pressable>
                </View>
              </SheetBar>
            ) : null}

            {isPhotoSheetActive ? (
              <PhotoGridBar
                width={gridWidth}
                selected={selected}
                active={panel.mode === 'photos' && !isFlying}
                fade={panel.gridOpacity}
                onBack={panel.backToMenu}
                onConfirm={confirmSelection}
              />
            ) : null}

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
  calendarConfirmSlot: {
    alignItems: 'flex-end',
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  calendarConfirmGlass: {
    alignItems: 'center',
    justifyContent: 'center',
    width: CALENDAR_CONFIRM_BUTTON_WIDTH,
    height: BOTTOM_BAR.controlSize,
  },
  calendarConfirmLabel: {
    color: COLORS.text,
    fontSize: BOTTOM_BAR.pillLabelSize,
    fontWeight: '600',
  },
});
