import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { KEYBOARD_COMPOSER_GAP } from '@/components/keyboard/keyboardLiftGeometry';
import { useKeyboardLift } from '@/components/keyboard/useKeyboardLift';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { ENABLE_PROGRESSIVE_BLUR } from '@/config/featureFlags';
import { useAppSafeAreaInsets } from '@/providers';
import { useAppTheme } from '@/theme';

type StickyActionFooterProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  height: number;
  keyboardAware?: boolean;
};

export function StickyActionFooter({
  children,
  contentContainerStyle,
  height,
  keyboardAware = false,
}: StickyActionFooterProps) {
  const { resolvedMode, theme } = useAppTheme();
  const insets = useAppSafeAreaInsets();
  const showProgressiveBlur = ENABLE_PROGRESSIVE_BLUR && Platform.OS === 'ios';
  const blurSafeAreaExtension = keyboardAware ? insets.bottom + KEYBOARD_COMPOSER_GAP : 0;

  const footerContent = (
    <>
      {showProgressiveBlur ? (
        <ProgressiveBlur
          edge="bottom"
          fadeStart={theme.spacing.sm}
          height={height + blurSafeAreaExtension}
          intensity={30}
          layers={4}
          style={{ bottom: keyboardAware ? -blurSafeAreaExtension : 0 }}
          tint={resolvedMode === 'dark' ? 'systemChromeMaterialDark' : 'systemUltraThinMaterial'}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.content,
          { paddingBottom: keyboardAware ? 0 : insets.bottom + theme.spacing.sm },
          contentContainerStyle,
        ]}
      >
        {children}
      </View>
    </>
  );

  if (keyboardAware) {
    return (
      <KeyboardLiftedContainer bottomInset={insets.bottom} style={[styles.container, { height }]}>
        {footerContent}
      </KeyboardLiftedContainer>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.container, { height }]}>
      {footerContent}
    </View>
  );
}

function KeyboardLiftedContainer({
  bottomInset,
  children,
  style,
}: {
  bottomInset: number;
  children: ReactNode;
  style: StyleProp<ViewStyle>;
}) {
  const { style: keyboardLiftStyle } = useKeyboardLift(bottomInset);

  return (
    <Animated.View pointerEvents="box-none" style={[style, keyboardLiftStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { bottom: 0, left: 0, position: 'absolute', right: 0, zIndex: 3 },
  content: { bottom: 0, left: 0, position: 'absolute', right: 0 },
});
