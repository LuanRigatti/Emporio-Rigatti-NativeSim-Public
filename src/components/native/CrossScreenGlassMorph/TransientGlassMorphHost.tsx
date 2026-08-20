import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui/swift-ui';
import { NativeCrossScreenMorphView } from 'native-liquid-glass';

import { useAppTheme } from '@/theme';
import { useCrossScreenGlassMorph } from './CrossScreenGlassMorphContext';

const BUTTON_SIZE = 44;
const EXPANDED_WIDTH = 100;

export function TransientGlassMorphHost() {
  const { morphState, setMorphState } = useCrossScreenGlassMorph();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();

  if (Platform.OS !== 'ios' || morphState === null) {
    return null;
  }

  const isExpanded = morphState === 'capsule';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          paddingRight: theme.layout.screenHorizontalPadding,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.hostContainer}>
        <Host matchContents style={styles.morphView}>
          <NativeCrossScreenMorphView
            animationBounce={0.36}
            animationDuration={0.46}
            collapsedSystemImage="ellipsis"
            expandedSystemImage="xmark"
            glassIdentity="cross-screen-glass-surface"
            onActionPress={(event) => {
              if (event.nativeEvent.id === 'secondary') {
                setMorphState('circle');
              } else if (event.nativeEvent.id === 'primary') {
                setMorphState(isExpanded ? 'circle' : 'capsule');
              }
            }}
            spacing={8}
            state={isExpanded ? 'capsule' : 'circle'}
            style={styles.morphView}
          />
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hostContainer: {
    alignItems: 'flex-end',
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: EXPANDED_WIDTH,
  },
  morphView: {
    height: BUTTON_SIZE,
    width: EXPANDED_WIDTH,
  },
  overlay: {
    alignItems: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 999,
  },
});
