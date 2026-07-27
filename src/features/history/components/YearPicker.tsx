import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/premium';
import { useAppTheme } from '@/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

import { getAvailableHistoryYears } from '../utils/historyDateUtils';
import { PeriodPickerMenu, type PeriodPickerAnchorRect } from './PeriodPickerMenu';
import HistorySymbolIcon from './HistorySymbolIcon';

export type YearPickerProps = {
  year: number;
  onChange: (year: number) => void;
};

export function YearPicker({ onChange, year }: YearPickerProps) {
  const { theme } = useAppTheme();
  const buttonRef = useRef<View>(null);
  const [anchorRect, setAnchorRect] = useState<PeriodPickerAnchorRect | null>(null);
  const years = useMemo(() => getAvailableHistoryYears(), []);

  const handleOpen = () => {
    triggerSelectionHaptic();
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorRect({ height, width, x, y });
    });
  };

  const handleClose = () => setAnchorRect(null);

  return (
    <>
      <GlassSurface
        interactive
        style={[
          styles.controlSurface,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.glassBorder,
            borderRadius: theme.radius.pill,
          },
        ]}
      >
        <Pressable
          accessibilityLabel={`Ano selecionado: ${year}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: Boolean(anchorRect) }}
          hitSlop={6}
          onPress={handleOpen}
          ref={buttonRef}
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed ? theme.opacities.pressed : 1 },
          ]}
        >
          <Text style={[theme.typography.subheadline, { color: theme.colors.textPrimary }]}>
            {year}
          </Text>
          <HistorySymbolIcon
            color={theme.colors.textSecondary}
            fallbackIcon="chevron-down"
            size={theme.sizes.iconSmall}
            systemName="chevron.down"
          />
        </Pressable>
      </GlassSurface>
      <PeriodPickerMenu
        anchorRect={anchorRect ?? { height: 0, width: 0, x: 0, y: 0 }}
        items={years.map((value) => ({ label: String(value), value }))}
        onClose={handleClose}
        onSelect={(value) => {
          onChange(value);
          handleClose();
        }}
        selectedValue={year}
        visible={Boolean(anchorRect)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  controlSurface: { overflow: 'hidden' },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 30,
    paddingHorizontal: 10,
  },
});
