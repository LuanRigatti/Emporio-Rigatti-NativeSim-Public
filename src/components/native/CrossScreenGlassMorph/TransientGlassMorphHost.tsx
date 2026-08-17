import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { NativeCrossScreenMorphView } from 'native-liquid-glass';

import { useCrossScreenGlassMorph } from './CrossScreenGlassMorphContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function TransientGlassMorphHost() {
  const { activeTransition, finishTransition } = useCrossScreenGlassMorph();

  if (!activeTransition) {
    return null;
  }

  const { isTarget, morphId, source } = activeTransition;

  const topOffset = source.bounds.y;
  const rightOffset = Math.max(0, SCREEN_WIDTH - (source.bounds.x + source.bounds.width));

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View
        style={[
          styles.hostPositioner,
          {
            right: rightOffset,
            top: topOffset,
          },
        ]}
      >
        <NativeCrossScreenMorphView
          animationBounce={0.06}
          animationDuration={0.38}
          glassIdentity={morphId}
          onAnimationComplete={finishTransition}
          state={isTarget ? 'capsule' : 'circle'}
          style={styles.morphView}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hostPositioner: {
    alignItems: 'flex-end',
    height: 44,
    justifyContent: 'flex-start',
    position: 'absolute',
  },
  morphView: {
    height: 44,
    minWidth: 44,
  },
  overlay: {
    bottom: 0,
    elevation: 99999,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 99999,
  },
});
