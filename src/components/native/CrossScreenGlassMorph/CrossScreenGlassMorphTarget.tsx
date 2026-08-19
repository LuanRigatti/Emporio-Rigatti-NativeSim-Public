import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type CrossScreenGlassMorphTargetProps = {
  morphId?: string;
  shape?: 'circle' | 'capsule';
  symbols?: string[];
  color?: string;
  size?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function CrossScreenGlassMorphTarget({
  height = 44,
  shape = 'circle',
  style,
  width = shape === 'circle' ? 44 : 90,
}: CrossScreenGlassMorphTargetProps) {
  return <View style={[styles.placeholder, { height, width }, style]} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'transparent',
  },
});
