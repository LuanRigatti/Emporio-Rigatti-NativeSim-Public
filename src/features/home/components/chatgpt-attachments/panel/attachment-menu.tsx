import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { AttachmentIcon } from '../AttachmentIcon';
import { COLORS, MENU, MENU_HEIGHT, PANEL_CONTENT } from '../constants';

export type MenuAction = 'camera' | 'photos' | 'date' | 'files';

interface MenuItem {
  action: MenuAction;
  label: string;
  icon: 'camera' | 'photos' | 'calendar' | 'paperclip';
}

const ITEMS: MenuItem[] = [
  { action: 'camera', label: 'Câmera', icon: 'camera' },
  { action: 'photos', label: 'Fotos', icon: 'photos' },
  { action: 'date', label: 'Data', icon: 'calendar' },
  { action: 'files', label: 'Arquivos', icon: 'paperclip' },
];

interface AttachmentMenuProps {
  onSelect: (action: MenuAction) => void;
}

export function AttachmentMenu({ onSelect }: AttachmentMenuProps) {
  const { resolvedMode, theme } = useAppTheme();
  const menuIconWell = resolvedMode === 'dark' ? COLORS.iconWell : theme.colors.backgroundSecondary;

  return (
    <View style={styles.root}>
      {ITEMS.map((item) => (
        <Pressable
          key={item.action}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => onSelect(item.action)}
          style={styles.row}
        >
          <View style={[styles.well, { backgroundColor: menuIconWell }]}>
            <AttachmentIcon
              name={item.icon}
              size={MENU.iconSize}
              color={theme.colors.textPrimary}
            />
          </View>
          <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...PANEL_CONTENT,
    width: MENU.width,
    height: MENU_HEIGHT,
    paddingVertical: MENU.paddingVertical,
  },
  row: {
    height: MENU.itemHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: MENU.iconInset,
  },
  well: {
    width: MENU.iconWell,
    height: MENU.iconWell,
    borderRadius: MENU.iconWell / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginLeft: MENU.labelGap,
    fontSize: MENU.labelSize,
    letterSpacing: -0.2,
  },
});
