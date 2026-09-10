import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/feedback';
import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerNativeButtonHaptic } from '@/utils/haptics';

import {
  HOME_TOOLBAR_AVATAR_SIZE,
  HOME_TOOLBAR_CONTROL_SIZE,
  HOME_TOOLBAR_HORIZONTAL_PADDING,
  HOME_TOOLBAR_WIDTH,
} from './NativeHomeToolbarActions.constants';
import type { NativeHomeToolbarActionsProps } from './NativeHomeToolbarActions.types';

export default function NativeHomeToolbarActionsFallback({
  accessibilityHint,
  accessibilityLabel = 'Abrir perfil da conta',
  foregroundColor,
  imageUri,
  name,
  onProfilePress,
  onSearchPress,
  searchAccessibilityLabel = 'Abrir Pesquisa',
}: NativeHomeToolbarActionsProps) {
  const { theme } = useAppTheme();

  return (
    <GlassSurface
      glassEffectStyle="clear"
      interactive
      style={[
        styles.surface,
        {
          backgroundColor: 'transparent',
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <View style={styles.actions}>
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={() => {
            triggerNativeButtonHaptic('light');
            onProfilePress();
          }}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.72 : 1 }]}
        >
          <Avatar
            dimension={HOME_TOOLBAR_AVATAR_SIZE}
            imageUri={imageUri ?? undefined}
            name={name}
            size="medium"
          />
        </Pressable>
        <Pressable
          accessibilityLabel={searchAccessibilityLabel}
          accessibilityRole="button"
          onPress={onSearchPress}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.72 : 1 }]}
        >
          <Ionicons
            color={foregroundColor ?? theme.colors.textPrimary}
            name="search-outline"
            size={19}
          />
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    height: HOME_TOOLBAR_CONTROL_SIZE,
    overflow: 'hidden',
    width: HOME_TOOLBAR_WIDTH,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: HOME_TOOLBAR_HORIZONTAL_PADDING,
  },
  action: {
    alignItems: 'center',
    height: HOME_TOOLBAR_CONTROL_SIZE,
    justifyContent: 'center',
    width: HOME_TOOLBAR_CONTROL_SIZE,
  },
});
