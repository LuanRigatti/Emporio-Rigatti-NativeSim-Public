import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';

import { Host } from '@expo/ui/swift-ui';

type RegistrarDeliveryPagerRNProps = {
  listPage: ReactElement;
  detailPage: ReactElement;
  requestedPage: 0 | 1;
  onPageSettled: (page: 0 | 1) => void;
};

export default function RegistrarDeliveryPagerRN({
  listPage,
  detailPage,
  requestedPage,
  onPageSettled,
}: RegistrarDeliveryPagerRNProps) {
  const pagerRef = useRef<ScrollView>(null);
  const settledPageRef = useRef<0 | 1>(0);
  const hasPositionedInitialPageRef = useRef(false);
  const [pagerWidth, setPagerWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) setPagerWidth(width);
  }, []);

  useEffect(() => {
    if (pagerWidth <= 0) return;

    pagerRef.current?.scrollTo({
      animated: hasPositionedInitialPageRef.current,
      x: pagerWidth * requestedPage,
      y: 0,
    });
    hasPositionedInitialPageRef.current = true;
  }, [pagerWidth, requestedPage]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pagerWidth <= 0) return;

      const page = Math.min(
        1,
        Math.max(0, Math.round(event.nativeEvent.contentOffset.x / pagerWidth)),
      ) as 0 | 1;

      if (page === settledPageRef.current) return;

      settledPageRef.current = page;
      onPageSettled(page);
    },
    [onPageSettled, pagerWidth],
  );

  return (
    <View onLayout={handleLayout} pointerEvents="box-none" style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.pagerContent}
        horizontal
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumScrollEnd}
        pagingEnabled
        ref={pagerRef}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        pointerEvents="box-none"
      >
        <View pointerEvents="box-none" style={[styles.page, { width: pagerWidth }]}>
          <Host pointerEvents="box-none" style={styles.nativePage}>
            {listPage}
          </Host>
        </View>
        <View pointerEvents="box-none" style={[styles.page, { width: pagerWidth }]}>
          <Host pointerEvents="box-none" style={styles.nativePage}>
            {detailPage}
          </Host>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    flex: 1,
    width: '100%',
  },
  nativePage: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  page: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  pager: {
    backgroundColor: 'transparent',
    flex: 1,
    width: '100%',
  },
  pagerContent: {
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
});
