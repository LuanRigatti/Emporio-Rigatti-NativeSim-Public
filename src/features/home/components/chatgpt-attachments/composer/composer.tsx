import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { AttachmentIcon } from '../AttachmentIcon';
import { COLORS, COMPOSER, COMPOSER_STRIP_HEIGHT, DURATION, GUTTER } from '../constants';
import { Glass } from '../glass';
import { formatLocalDateAttachment, formatLocalDateAttachmentCompact } from '../local-date';
import { AttachHoldButton } from './attach-hold-button';
import type { LibraryPhoto } from '../photos/use-photo-library';
import { getRecentHoldMenuPhotos } from './hold-menu';

interface ThumbnailProps {
  photo: LibraryPhoto;
  hidden: boolean;
  foreground: string;
  thumbBackground: string;
  onRemove: (id: string) => void;
}

function Thumbnail({ photo, hidden, foreground, onRemove, thumbBackground }: ThumbnailProps) {
  const isFile = photo.kind === 'file';

  return (
    <Animated.View
      exiting={FadeOut.duration(DURATION.crossfade)}
      layout={LinearTransition.duration(DURATION.attach)}
      style={[styles.thumb, { backgroundColor: thumbBackground }, hidden && styles.thumbHidden]}
    >
      {isFile ? (
        <View style={styles.fileThumb}>
          <AttachmentIcon name="document-text" size={28} color={foreground} />
          <Text numberOfLines={2} style={[styles.fileName, { color: foreground }]}>
            {photo.name ?? 'Arquivo'}
          </Text>
        </View>
      ) : (
        <Image
          source={photo.id}
          recyclingKey={photo.id}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remover anexo"
        hitSlop={10}
        onPress={() => onRemove(photo.id)}
        style={styles.remove}
      >
        <AttachmentIcon name="close" size={11} color={COLORS.text} />
      </Pressable>
    </Animated.View>
  );
}

export interface ComposerProps {
  attachments: LibraryPhoto[];
  recentPhotos: LibraryPhoto[];
  strip: SharedValue<number>;
  plusOut: SharedValue<number>;
  composerBottom: SharedValue<number>;
  screenWidth: number;
  pendingIds: string[];
  holdMenuPendingIds: string[];
  value: string;
  placeholder?: string;
  dateAttachment?: string;
  focusRequestKey?: number;
  blurRequestKey?: number;
  autoFocus?: boolean;
  onChangeText: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onSubmit?: (value: string) => void;
  onRemoveDateAttachment?: () => void;
  onPlusTap: () => void;
  onToggleModelIntensity: () => void;
  onHoldMenuVisibilityChange?: (visible: boolean) => void;
  modelIntensityExpanded: boolean;
  modelIntensityLabel: string;
  modelIntensityDisabled?: boolean;
  holdMenuEnabled: boolean;
  onHoldPhotoSelect: (photo: LibraryPhoto) => void;
  onHoldPhotoDockSettled: (photoId: string) => void;
  onRemove: (id: string) => void;
}

/** Direct port of the source composer, with the app's search field controlled by HomeSearchScreen. */
export const Composer = forwardRef<TextInputType, ComposerProps>(function Composer(
  {
    attachments,
    recentPhotos,
    strip,
    plusOut,
    composerBottom,
    screenWidth,
    pendingIds,
    holdMenuPendingIds,
    value,
    placeholder = 'Pesquisar',
    dateAttachment,
    focusRequestKey = 0,
    blurRequestKey = 0,
    autoFocus = false,
    onChangeText,
    onFocusChange,
    onSubmit,
    onRemoveDateAttachment,
    onPlusTap,
    onToggleModelIntensity,
    onHoldMenuVisibilityChange,
    modelIntensityExpanded,
    modelIntensityLabel,
    modelIntensityDisabled = false,
    holdMenuEnabled,
    onHoldPhotoSelect,
    onHoldPhotoDockSettled,
    onRemove,
  },
  ref,
) {
  const { resolvedMode, theme } = useAppTheme();
  const hasAttachments = attachments.length > 0;
  const foreground = resolvedMode === 'dark' ? COLORS.text : theme.colors.textPrimary;
  const placeholderColor =
    resolvedMode === 'dark' ? COLORS.placeholder : theme.colors.textSecondary;
  const composerSurface = resolvedMode === 'dark' ? COLORS.surface : theme.colors.glassSurface;
  const thumbBackground =
    resolvedMode === 'dark' ? COLORS.photoFill : theme.colors.backgroundSecondary;
  const holdMenuPhotos = useMemo(
    () =>
      getRecentHoldMenuPhotos(
        recentPhotos,
        attachments.map((attachment) => attachment.id),
        holdMenuPendingIds,
      ),
    [attachments, holdMenuPendingIds, recentPhotos],
  );

  const [retained, setRetained] = useState(attachments);
  useEffect(() => {
    // The retained strip must stay mounted until its native close animation ends.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasAttachments) setRetained(attachments);
  }, [attachments, hasAttachments]);

  useAnimatedReaction(
    () => strip.get() === 0,
    (shut, wasShut) => {
      if (shut && wasShut === false) scheduleOnRN(setRetained, [] as LibraryPhoto[]);
    },
  );

  useEffect(() => {
    if (autoFocus || focusRequestKey > 0) {
      (ref as React.RefObject<TextInputType>)?.current?.focus();
    }
  }, [autoFocus, focusRequestKey, ref]);

  useEffect(() => {
    if (blurRequestKey > 0) {
      (ref as React.RefObject<TextInputType>)?.current?.blur();
    }
  }, [blurRequestKey, ref]);

  const stripStyle = useAnimatedStyle(() => ({
    height: strip.get() * COMPOSER_STRIP_HEIGHT,
  }));

  return (
    <Glass
      radius={COMPOSER.radius}
      interactive
      variant="clear"
      fallbackTint={composerSurface}
      style={styles.root}
    >
      <Animated.View style={[styles.strip, stripStyle]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          style={styles.stripScroll}
          contentContainerStyle={styles.stripContent}
        >
          {retained.map((photo) => (
            <Thumbnail
              key={photo.id}
              photo={photo}
              hidden={pendingIds.includes(photo.id)}
              foreground={foreground}
              thumbBackground={thumbBackground}
              onRemove={onRemove}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <View style={styles.row}>
        <AttachHoldButton
          photos={holdMenuPhotos}
          attachmentCount={attachments.length}
          holdEnabled={holdMenuEnabled}
          plusOut={plusOut}
          composerBottom={composerBottom}
          strip={strip}
          screenWidth={screenWidth}
          onPress={onPlusTap}
          onHoldMenuVisibilityChange={onHoldMenuVisibilityChange}
          onPhotoSelect={onHoldPhotoSelect}
          onDockSettled={onHoldPhotoDockSettled}
        />

        {dateAttachment ? (
          <DateAttachmentChip
            date={dateAttachment}
            foreground={foreground}
            onRemove={onRemoveDateAttachment}
          />
        ) : null}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onSubmitEditing={() => onSubmit?.(value)}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardAppearance={resolvedMode === 'dark' ? 'dark' : 'light'}
          returnKeyType="search"
          submitBehavior="submit"
          multiline={false}
          style={[styles.field, { color: foreground }]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            modelIntensityExpanded ? 'Fechar intensidade do modelo' : 'Intensidade do modelo'
          }
          accessibilityHint="Abre o controle visual de intensidade do modelo."
          accessibilityState={{
            disabled: modelIntensityDisabled,
            expanded: modelIntensityExpanded,
          }}
          accessibilityValue={{ text: modelIntensityLabel }}
          disabled={modelIntensityDisabled}
          onPress={() => {
            triggerSelectionHaptic();
            onToggleModelIntensity();
          }}
          style={styles.intensityAction}
          testID="composer-model-intensity-button"
        >
          <Ionicons name="options-outline" size={18} color={foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pesquisar"
          onPress={() => onSubmit?.(value)}
          style={[styles.action, { backgroundColor: theme.colors.contrastSurface }]}
        >
          <AttachmentIcon name="arrow-up" size={18} color={theme.colors.contrastContent} />
        </Pressable>
      </View>
    </Glass>
  );
});

function DateAttachmentChip({
  date,
  foreground,
  onRemove,
}: {
  date: string;
  foreground: string;
  onRemove?: () => void;
}) {
  const { theme } = useAppTheme();
  const label = formatLocalDateAttachmentCompact(date);
  const accessibilityDate = formatLocalDateAttachment(date);

  return (
    <Glass
      interactive={false}
      radius={COMPOSER.dateChipHeight / 2}
      style={styles.dateChip}
      variant="regular"
    >
      <View style={styles.dateChipContent}>
        <Text
          accessibilityLabel={accessibilityDate}
          numberOfLines={1}
          style={[
            theme.typography.footnote,
            styles.dateChipLabel,
            { color: foreground, fontSize: theme.typography.footnote.fontSize + 1 },
          ]}
        >
          {label}
        </Text>
        <Pressable
          accessibilityLabel={`Remover data ${accessibilityDate}`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={onRemove}
          style={styles.dateChipRemove}
        >
          <AttachmentIcon name="close" size={12} color={foreground} />
        </Pressable>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: GUTTER },
  strip: {
    overflow: 'hidden',
    borderTopLeftRadius: COMPOSER.radius - COMPOSER.stripPaddingTop,
    borderTopRightRadius: COMPOSER.radius - COMPOSER.stripPaddingTop,
    borderCurve: 'continuous',
  },
  stripScroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: COMPOSER.stripPaddingTop,
    height: COMPOSER.thumbSize,
  },
  stripContent: {
    paddingLeft: COMPOSER.stripPaddingTop,
    gap: COMPOSER.thumbGap,
  },
  thumb: {
    width: COMPOSER.thumbSize,
    height: COMPOSER.thumbSize,
    borderRadius: COMPOSER.thumbRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  thumbHidden: { opacity: 0 },
  fileThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  fileName: {
    fontSize: 13,
    textAlign: 'center',
  },
  row: {
    height: COMPOSER.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: COMPOSER.rowPaddingLeft,
    paddingRight: 9,
    gap: 10,
  },
  dateChip: {
    maxWidth: COMPOSER.dateChipMaxWidth,
    height: COMPOSER.dateChipHeight,
    borderRadius: COMPOSER.dateChipHeight / 2,
    borderCurve: 'continuous',
    flexShrink: 0,
  },
  dateChipContent: {
    height: COMPOSER.dateChipHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 9,
    paddingRight: 5,
    gap: 3,
  },
  dateChipLabel: {
    flexShrink: 1,
    fontWeight: '600',
  },
  dateChipRemove: {
    width: 20,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  field: {
    flex: 1,
    minWidth: 0,
    fontSize: COMPOSER.fieldSize,
    padding: 0,
  },
  remove: {
    position: 'absolute',
    top: COMPOSER.removeBadgeInset,
    right: COMPOSER.removeBadgeInset,
    width: COMPOSER.removeBadge,
    height: COMPOSER.removeBadge,
    borderRadius: COMPOSER.removeBadge / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  action: {
    width: COMPOSER.actionSize,
    height: COMPOSER.actionSize,
    borderRadius: COMPOSER.actionSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intensityAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
