import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
  useWindowDimensions,
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
  const { width: viewportWidth } = useWindowDimensions();
  const [pagerWidth, setPagerWidth] = useState(0);
  const effectivePagerWidth = pagerWidth || viewportWidth;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) setPagerWidth((current) => (current === width ? current : width));
  }, []);

  useEffect(() => {
    if (effectivePagerWidth <= 0) return;

    pagerRef.current?.scrollTo({
      animated: true,
      x: effectivePagerWidth * requestedPage,
      y: 0,
    });
  }, [effectivePagerWidth, requestedPage]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (effectivePagerWidth <= 0) return;

      const page = Math.min(
        1,
        Math.max(0, Math.round(event.nativeEvent.contentOffset.x / effectivePagerWidth)),
      ) as 0 | 1;

      if (page === settledPageRef.current) return;

      settledPageRef.current = page;
      onPageSettled(page);
    },
    [effectivePagerWidth, onPageSettled],
  );

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.pagerContent}
        horizontal
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumScrollEnd}
        pagingEnabled
        ref={pagerRef}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
      >
        <View style={[styles.page, { width: effectivePagerWidth }]}>
          <Host style={styles.nativePage}>{listPage}</Host>
        </View>
        <View style={[styles.page, { width: effectivePagerWidth }]}>
          <Host style={styles.nativePage}>{detailPage}</Host>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  nativePage: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pager: {
    flex: 1,
    width: '100%',
  },
  pagerContent: {
    alignItems: 'stretch',
    flexGrow: 1,
  },
});
