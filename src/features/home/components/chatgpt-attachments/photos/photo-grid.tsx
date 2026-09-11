import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BOTTOM_BAR, GRID, PANEL_CONTENT, type Frame } from '../constants';
import { SheetPlaceholder } from '../panel/sheet-placeholder';
import { PhotoCell, slotSize } from './photo-cell';
import type { LibraryPhoto, LibraryStatus } from './use-photo-library';

interface PhotoGridProps {
  width: number;
  height: number;
  photos: LibraryPhoto[];
  status: LibraryStatus;
  selected: string[];
  lifting: boolean;
  onTogglePhoto: (photo: LibraryPhoto) => void;
}

export interface PhotoGridHandle {
  measureCell: (id: string) => Frame | null;
}

export const PhotoGrid = forwardRef<PhotoGridHandle, PhotoGridProps>(function PhotoGrid(
  { width, height, photos, status, selected, lifting, onTogglePhoto },
  handle,
) {
  const slot = slotSize(width);
  const listRef = useRef<FlashListRef<LibraryPhoto>>(null);

  useImperativeHandle(
    handle,
    () => ({
      measureCell: (id) => {
        const list = listRef.current;
        const index = photos.findIndex((photo) => photo.id === id);
        if (!list || index < 0) return null;
        const layout = list.getLayout(index);
        if (!layout) return null;
        const scrolled = list.getAbsoluteLastScrollOffset() - list.getFirstItemOffset();
        return {
          x: layout.x,
          y: layout.y - scrolled,
          w: layout.width - GRID.gap,
          h: layout.height - GRID.gap,
        };
      },
    }),
    [photos],
  );

  return (
    <View style={[styles.root, { width, height }]}>
      {status === 'ready' ? (
        <FlashList
          ref={listRef}
          data={photos}
          numColumns={GRID.columns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PhotoCell
              photo={item}
              slot={slot}
              order={selected.indexOf(item.id) + 1}
              lifted={lifting && selected.includes(item.id)}
              onPress={onTogglePhoto}
            />
          )}
          extraData={`${selected.join()}|${lifting}`}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          ListFooterComponent={<View style={styles.footer} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <SheetPlaceholder>
          {status === 'loading'
            ? 'Carregando fotos…'
            : status === 'empty'
              ? 'Nenhuma foto neste dispositivo.'
              : 'O acesso às fotos está desativado. Ative-o nos Ajustes para testar.'}
        </SheetPlaceholder>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { ...PANEL_CONTENT },
  footer: {
    height: BOTTOM_BAR.inset + BOTTOM_BAR.pillHeight + 24,
  },
});
