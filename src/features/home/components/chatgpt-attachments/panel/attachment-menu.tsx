import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AttachmentIcon } from '../AttachmentIcon';
import { COLORS, MENU, MENU_HEIGHT, PANEL_CONTENT } from '../constants';

export type MenuAction = 'camera' | 'photos' | 'files';

interface MenuItem {
  action: MenuAction;
  label: string;
  icon: 'camera' | 'photos' | 'paperclip';
}

const ITEMS: MenuItem[] = [
  { action: 'camera', label: 'Câmera', icon: 'camera' },
  { action: 'photos', label: 'Fotos', icon: 'photos' },
  { action: 'files', label: 'Arquivos', icon: 'paperclip' },
];

interface AttachmentMenuProps {
  onSelect: (action: MenuAction) => void;
}

export function AttachmentMenu({ onSelect }: AttachmentMenuProps) {
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
          <View style={styles.well}>
            <AttachmentIcon name={item.icon} size={MENU.iconSize} color={COLORS.text} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
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
    backgroundColor: COLORS.iconWell,
  },
  label: {
    marginLeft: MENU.labelGap,
    color: COLORS.text,
    fontSize: MENU.labelSize,
    letterSpacing: -0.2,
  },
});
