import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardController } from 'react-native-keyboard-controller';
import {
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DURATION, EASE_FADE, EASE_OUT, SPRING } from './constants';
import type { MenuAction } from './panel/attachment-menu';

export type Mode = 'closed' | 'menu' | 'photos' | 'camera';
export type Sheet = 'photos' | 'camera';

interface PanelOptions {
  onLeaveSheet?: () => void;
}

export function useAttachmentPanel({ onLeaveSheet }: PanelOptions = {}) {
  const [mode, setMode] = useState<Mode>('closed');
  const [sheet, setSheet] = useState<Sheet>('photos');
  const [closing, setClosing] = useState(false);
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useSharedValue(0);
  const plusOut = useSharedValue(0);
  const morph = useSharedValue(0);
  const menuOpacity = useSharedValue(1);
  const gridOpacity = useSharedValue(0);
  const blur = useSharedValue(0);

  useEffect(
    () => () => {
      if (leadTimer.current !== null) clearTimeout(leadTimer.current);
    },
    [],
  );

  const closeSheet = useCallback(() => {
    setMode('closed');
    setClosing(false);
    KeyboardController.setFocusTo('current');
  }, []);

  const pulseBlur = useCallback(() => {
    blur.set(
      withSequence(
        withTiming(1, { duration: 60, easing: EASE_OUT }),
        withTiming(0, { duration: DURATION.blur, easing: EASE_FADE }),
      ),
    );
  }, [blur]);

  const clearLead = useCallback(() => {
    if (leadTimer.current === null) return;
    clearTimeout(leadTimer.current);
    leadTimer.current = null;
  }, []);

  const openMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    plusOut.set(withSpring(1, SPRING.panel));
    morph.set(0);
    gridOpacity.set(0);
    menuOpacity.set(1);
    blur.set(1);
    clearLead();
    leadTimer.current = setTimeout(() => {
      leadTimer.current = null;
      setMode('menu');
      open.set(withSpring(1, SPRING.panel));
      blur.set(withTiming(0, { duration: DURATION.blur, easing: EASE_FADE }));
    }, DURATION.plusLead);
  }, [blur, clearLead, gridOpacity, menuOpacity, morph, open, plusOut]);

  const dismiss = useCallback(() => {
    clearLead();
    onLeaveSheet?.();
    setClosing(true);
    blur.set(withTiming(1, { duration: DURATION.panel, easing: EASE_FADE }));
    morph.set(withSpring(0, SPRING.panelOut));
    menuOpacity.set(withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE }));
    gridOpacity.set(withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE }));
    open.set(
      withSpring(0, SPRING.panelOut, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(closeSheet);
      }),
    );
    plusOut.set(withDelay(DURATION.plusLead, withSpring(0, SPRING.panelOut)));
  }, [blur, clearLead, closeSheet, gridOpacity, menuOpacity, morph, onLeaveSheet, open, plusOut]);

  const showSheet = useCallback(
    (next: Sheet) => {
      setSheet(next);
      setMode(next);
      pulseBlur();
      morph.set(withSpring(1, SPRING.panel));
      menuOpacity.set(withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE }));
      gridOpacity.set(withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE }));
    },
    [gridOpacity, menuOpacity, morph, pulseBlur],
  );

  const backToMenu = useCallback(() => {
    setMode('menu');
    onLeaveSheet?.();
    pulseBlur();
    morph.set(withSpring(0, SPRING.panel));
    menuOpacity.set(withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE }));
    gridOpacity.set(withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE }));
  }, [gridOpacity, menuOpacity, morph, onLeaveSheet, pulseBlur]);

  const onMenuAction = useCallback(
    (action: MenuAction) => {
      if (action === 'photos') showSheet('photos');
      else if (action === 'camera') showSheet('camera');
      else dismiss();
    },
    [dismiss, showSheet],
  );

  const onPlusPress = useCallback(() => {
    if (mode === 'closed' && leadTimer.current === null) openMenu();
    else dismiss();
  }, [dismiss, mode, openMenu]);

  const collapseForLeave = useCallback(() => {
    setClosing(true);
    blur.set(withTiming(1, { duration: DURATION.panel, easing: EASE_FADE }));
    gridOpacity.set(withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE }));
    morph.set(withSpring(0, SPRING.panelOut));
    open.set(withSpring(0, SPRING.panelOut));
    plusOut.set(withDelay(DURATION.plusLead, withSpring(0, SPRING.panelOut)));
  }, [blur, gridOpacity, morph, open, plusOut]);

  const resetAfterLeave = useCallback(() => {
    closeSheet();
    open.set(0);
    morph.set(0);
    gridOpacity.set(0);
    menuOpacity.set(1);
    blur.set(0);
  }, [blur, closeSheet, gridOpacity, menuOpacity, morph, open]);

  return {
    mode,
    sheet,
    closing,
    open,
    plusOut,
    morph,
    menuOpacity,
    gridOpacity,
    blur,
    onPlusPress,
    dismiss,
    backToMenu,
    onMenuAction,
    collapseForLeave,
    resetAfterLeave,
  };
}
