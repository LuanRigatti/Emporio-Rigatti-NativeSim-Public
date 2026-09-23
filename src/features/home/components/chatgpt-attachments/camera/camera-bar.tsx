import type { FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { AttachmentIcon } from '../AttachmentIcon';
import {
  ATTACHMENT_CONTROL_GLASS_TINT,
  BOTTOM_BAR,
  CAMERA,
  COLORS,
  DURATION,
  SPRING,
} from '../constants';
import { Glass } from '../glass';
import { SheetBar } from '../panel/sheet-bar';

interface OptionProps {
  index: number;
  label: string;
  icon: 'camera-flip' | 'flash' | 'flash-off';
  unfold: SharedValue<number>;
  active: boolean;
  fade: SharedValue<number>;
  onPress: () => void;
}

function Option({ index, label, icon, unfold, active, fade, onPress }: OptionProps) {
  const rise = index * (BOTTOM_BAR.controlSize + CAMERA.optionGap);
  const style = useAnimatedStyle(() => {
    const u = unfold.get();
    return {
      transform: [
        { translateY: -rise * u },
        {
          scale: interpolate(u, [0, 1], [CAMERA.optionStartScale, 1], Extrapolation.EXTEND),
        },
      ],
    };
  });
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(unfold.get(), [0.2, 0.8], [0, 1], Extrapolation.CLAMP) * fade.get(),
  }));

  return (
    <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[styles.option, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Glass
          radius={BOTTOM_BAR.controlSize / 2}
          active={active}
          duration={DURATION.crossfade / 1000}
          tintColor={ATTACHMENT_CONTROL_GLASS_TINT}
          fallbackTint={ATTACHMENT_CONTROL_GLASS_TINT}
          style={styles.round}
        >
          <Animated.View style={iconStyle}>
            <AttachmentIcon name={icon} size={CAMERA.optionIcon} color={COLORS.text} />
          </Animated.View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

interface CameraBarProps {
  width: number;
  active: boolean;
  fade: SharedValue<number>;
  flash: FlashMode;
  onBack: () => void;
  onCapture: () => void;
  onFlip: () => void;
  onToggleFlash: () => void;
}

export function CameraBar({
  width,
  active,
  fade,
  flash,
  onBack,
  onCapture,
  onFlip,
  onToggleFlash,
}: CameraBarProps) {
  const [open, setOpen] = useState(false);
  const unfold = useSharedValue(0);

  const toggleOptions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen((was) => {
      unfold.set(withSpring(was ? 0 : 1, was ? SPRING.panelOut : SPRING.panel));
      return !was;
    });
  }, [unfold]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(unfold.get(), [0, 0.5], [1, 0], Extrapolation.CLAMP) * fade.get(),
  }));
  const closeStyle = useAnimatedStyle(() => {
    const u = unfold.get();
    return {
      opacity: interpolate(u, [0.3, 0.8], [0, 1], Extrapolation.CLAMP) * fade.get(),
      transform: [{ rotate: `${interpolate(u, [0, 1], [-90, 0])}deg` }],
    };
  });

  return (
    <SheetBar width={width} active={active} fade={fade} onBack={onBack}>
      <View pointerEvents="box-none" style={styles.shutterSlot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tirar foto" onPress={onCapture}>
          <Glass
            radius={CAMERA.shutterSize / 2}
            active={active}
            duration={DURATION.crossfade / 1000}
            tintColor={ATTACHMENT_CONTROL_GLASS_TINT}
            fallbackTint={ATTACHMENT_CONTROL_GLASS_TINT}
            style={styles.shutter}
          >
            <Animated.View style={[styles.shutterDisc, contentStyle]} />
          </Glass>
        </Pressable>
      </View>

      <View style={styles.more}>
        <Option
          index={2}
          label={flash === 'off' ? 'Ativar flash' : 'Desativar flash'}
          icon={flash === 'off' ? 'flash-off' : 'flash'}
          unfold={unfold}
          active={active && open}
          fade={fade}
          onPress={onToggleFlash}
        />
        <Option
          index={1}
          label="Inverter câmera"
          icon="camera-flip"
          unfold={unfold}
          active={active && open}
          fade={fade}
          onPress={onFlip}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Ocultar opções da câmera' : 'Opções da câmera'}
          accessibilityState={{ expanded: open }}
          onPress={toggleOptions}
        >
          <Glass
            radius={BOTTOM_BAR.controlSize / 2}
            active={active}
            duration={DURATION.crossfade / 1000}
            tintColor={ATTACHMENT_CONTROL_GLASS_TINT}
            fallbackTint={ATTACHMENT_CONTROL_GLASS_TINT}
            style={styles.round}
          >
            <Animated.View style={[styles.glyph, dotsStyle]}>
              <AttachmentIcon name="ellipsis" size={CAMERA.optionIcon} color={COLORS.text} />
            </Animated.View>
            <Animated.View style={[styles.glyph, closeStyle]}>
              <AttachmentIcon name="close" size={BOTTOM_BAR.backIcon} color={COLORS.text} />
            </Animated.View>
          </Glass>
        </Pressable>
      </View>
    </SheetBar>
  );
}

const styles = StyleSheet.create({
  round: {
    width: BOTTOM_BAR.controlSize,
    height: BOTTOM_BAR.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { position: 'absolute' },
  shutterSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (BOTTOM_BAR.controlSize - CAMERA.shutterSize) / 2,
    alignItems: 'center',
  },
  shutter: {
    width: CAMERA.shutterSize,
    height: CAMERA.shutterSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisc: {
    width: CAMERA.shutterSize - CAMERA.shutterPadding * 2,
    height: CAMERA.shutterSize - CAMERA.shutterPadding * 2,
    borderRadius: (CAMERA.shutterSize - CAMERA.shutterPadding * 2) / 2,
    backgroundColor: COLORS.text,
  },
  more: {
    width: BOTTOM_BAR.controlSize,
    height: BOTTOM_BAR.controlSize,
  },
  option: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
