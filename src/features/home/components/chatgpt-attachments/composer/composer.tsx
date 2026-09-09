import { Image } from 'expo-image';
import { forwardRef, useEffect, useState } from 'react';
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
  Extrapolation,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppTheme } from '@/theme';
import { AttachmentIcon } from '../AttachmentIcon';
import { COLORS, COMPOSER, COMPOSER_STRIP_HEIGHT, DURATION, GUTTER } from '../constants';
import { Glass } from '../glass';
import type { LibraryPhoto } from '../photos/use-photo-library';

interface ThumbnailProps {
  photo: LibraryPhoto;
  hidden: boolean;
  onRemove: (id: string) => void;
}

function Thumbnail({ photo, hidden, onRemove }: ThumbnailProps) {
  const isFile = photo.kind === 'file';

  return (
    <Animated.View
      exiting={FadeOut.duration(DURATION.crossfade)}
      layout={LinearTransition.duration(DURATION.attach)}
      style={[styles.thumb, hidden && styles.thumbHidden]}
    >
      {isFile ? (
        <View style={styles.fileThumb}>
          <AttachmentIcon name="document-text" size={28} color={COLORS.text} />
          <Text numberOfLines={2} style={styles.fileName}>
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
  strip: SharedValue<number>;
  plusOut: SharedValue<number>;
  pendingIds: string[];
  value: string;
  placeholder?: string;
  focusRequestKey?: number;
  blurRequestKey?: number;
  autoFocus?: boolean;
  onChangeText: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onSubmit?: (value: string) => void;
  onPlusPress: () => void;
  onRemove: (id: string) => void;
}

/** Direct port of the source composer, with the app's search field controlled by HomeSearchScreen. */
export const Composer = forwardRef<TextInputType, ComposerProps>(function Composer(
  {
    attachments,
    strip,
    plusOut,
    pendingIds,
    value,
    placeholder = 'Pesquisar',
    focusRequestKey = 0,
    blurRequestKey = 0,
    autoFocus = false,
    onChangeText,
    onFocusChange,
    onSubmit,
    onPlusPress,
    onRemove,
  },
  ref,
) {
  const { resolvedMode, theme } = useAppTheme();
  const hasAttachments = attachments.length > 0;
  const foreground = resolvedMode === 'dark' ? COLORS.text : theme.colors.textPrimary;
  const placeholderColor =
    resolvedMode === 'dark' ? COLORS.placeholder : theme.colors.textSecondary;
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plusOut.get(), [0, 0.75], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: plusOut.get() * COMPOSER.plusSlide }],
  }));

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
      interactive={false}
      fallbackTint={COLORS.surface}
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
              onRemove={onRemove}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar anexo"
          hitSlop={12}
          onPress={onPlusPress}
          style={styles.plus}
        >
          <Animated.View style={plusStyle}>
            <AttachmentIcon name="plus" size={COMPOSER.plusSize} color={foreground} />
          </Animated.View>
        </Pressable>

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
          multiline={false}
          style={[styles.field, { color: foreground }]}
        />

        <Pressable accessibilityRole="button" accessibilityLabel="Ditado" hitSlop={10}>
          <AttachmentIcon name="mic" size={COMPOSER.micSize} color={foreground} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasAttachments ? 'Enviar' : 'Modo voz'}
          onPress={() => onSubmit?.(value)}
          style={styles.action}
        >
          <AttachmentIcon
            name={hasAttachments ? 'arrow-up' : 'audio-lines'}
            size={18}
            color={COLORS.background}
          />
        </Pressable>
      </View>
    </Glass>
  );
});

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
    backgroundColor: COLORS.photoFill,
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
    color: COLORS.text,
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
  plus: {
    width: COMPOSER.plusHit,
    alignItems: 'center',
  },
  field: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
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
    backgroundColor: COLORS.text,
  },
});
