import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumScreen } from '@/components/premium';
import { useAppSafeAreaInsets } from '@/providers';
import { getCardSurfaceColor, spacing, useAppTheme } from '@/theme';
import { prewarmAppleIntelligence } from '../search/AppleIntelligenceSearchInterpreter';
import HomeSearchResultsContent from './HomeSearchResultsContent';
import HomeSearchHelpContent from '../help/HomeSearchHelpContent';
import HomeSearchAttachmentsComposer from './HomeSearchAttachmentsComposer';
import { COMPOSER_COLLAPSED_HEIGHT } from './chatgpt-attachments/constants';
import { useHomeSearch } from '../hooks/useHomeSearch';
import HomeSearchScreenNativeHost from './HomeSearchScreenNativeHost';

type NativeStackTransitionNavigation = {
  addListener: (
    event: 'transitionEnd' | 'focus',
    listener: (event: { data?: { closing?: boolean } }) => void,
  ) => () => void;
  getParent?: () => NativeStackTransitionNavigation | undefined;
};

export default function HomeSearchScreen() {
  const navigation = useNavigation();
  const insets = useAppSafeAreaInsets();
  const { resolvedMode, theme } = useAppTheme();
  const { response, loading, search } = useHomeSearch();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [blurRequestKey, setBlurRequestKey] = useState(0);
  const focusRequestedRef = useRef(false);
  const screenFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      focusRequestedRef.current = false;

      return () => {
        screenFocusedRef.current = false;
        focusRequestedRef.current = false;
        setBlurRequestKey((currentKey) => currentKey + 1);
        Keyboard.dismiss();
      };
    }, []),
  );

  useEffect(() => {
    const nativeStackNavigation = navigation as unknown as NativeStackTransitionNavigation;
    const parentNavigation = nativeStackNavigation.getParent?.();

    const requestFocus = () => {
      const blockedByRouteFocus = !screenFocusedRef.current;
      const blockedByFocusRef = focusRequestedRef.current;
      if (blockedByRouteFocus || blockedByFocusRef) {
        return;
      }

      focusRequestedRef.current = true;
      setFocusRequestKey((currentKey) => currentKey + 1);
    };

    let interactionTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    let unsubscribeFallbackFocus: (() => void) | null = null;
    let unsubscribeParentTransitionEnd: (() => void) | null = null;

    if (parentNavigation) {
      unsubscribeParentTransitionEnd = parentNavigation.addListener('transitionEnd', (event) => {
        const blockedByClosing = Boolean(event.data?.closing);

        if (blockedByClosing) return;
        requestFocus();
      });
    } else {
      const scheduleInteractionFallback = () => {
        if (interactionTask) interactionTask.cancel();
        interactionTask = InteractionManager.runAfterInteractions(() => {
          requestFocus();
        });
      };

      unsubscribeFallbackFocus = nativeStackNavigation.addListener(
        'focus',
        scheduleInteractionFallback,
      );
      if (screenFocusedRef.current) scheduleInteractionFallback();
    }

    return () => {
      unsubscribeParentTransitionEnd?.();
      unsubscribeFallbackFocus?.();
      interactionTask?.cancel();
    };
  }, [navigation]);

  const handleSubmit = useCallback(
    (value: string) => {
      const nextQuery = value.trim();
      if (!nextQuery) return;

      setSubmittedQuery(nextQuery);
      Keyboard.dismiss();
      void search(nextQuery);
    },
    [search],
  );

  const handleChangeText = useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) setSubmittedQuery('');
  }, []);

  const handleSelectSuggestion = useCallback(
    (value: string) => {
      setQuery(value);
      handleSubmit(value);
    },
    [handleSubmit],
  );

  const header = (
    <NativeGlassHeader includeTopSafeArea mode="transparent" pointerEvents="box-none" title="" />
  );
  const pageTitle = (
    <NativeGlassHeader
      includeTopSafeArea={false}
      largeTitle
      mode="transparent"
      title="Pesquisa"
      titleStyle={{
        fontFamily: 'System',
        fontSize: 36,
        fontWeight: '700',
        marginLeft: -(theme.spacing.xxs * 2),
      }}
    />
  );
  const showSuggestions = query.trim().length === 0;
  const visibleResponse = submittedQuery === query.trim() && !loading ? response : null;

  return (
    <PremiumScreen
      contentContainerStyle={{
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: 0,
      }}
      overlayHeader={header}
      overlayHeaderContentOffset={theme.sizes.touchTargetMinimum}
      overlayHeaderSpacing={0}
      progressiveBlur
      scrollable={false}
    >
      <View style={styles.searchBody}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.searchScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.resultsScroll}
        >
          <View
            style={[
              styles.pageTitleBlock,
              {
                marginTop: theme.spacing.xl + theme.spacing.xxl + theme.spacing.xxs * 2 + 2,
                paddingHorizontal: theme.layout.screenHorizontalPadding,
              },
            ]}
          >
            {pageTitle}
          </View>
          {showSuggestions ? (
            <HomeSearchScreenNativeHost mode="content">
              <HomeSearchHelpContent
                cardBackground={getCardSurfaceColor(resolvedMode, theme.colors.surface)}
                onSelectQuery={handleSelectSuggestion}
              />
            </HomeSearchScreenNativeHost>
          ) : (
            <HomeSearchScreenNativeHost mode="content">
              <HomeSearchResultsContent
                isLarge
                loading={loading}
                response={visibleResponse}
                scrollable={false}
              />
            </HomeSearchScreenNativeHost>
          )}
        </ScrollView>
        <HomeSearchAttachmentsComposer
          blurRequestKey={blurRequestKey}
          focusRequestKey={focusRequestKey}
          onChangeText={handleChangeText}
          onFocusChange={(focused) => {
            if (focused) void prewarmAppleIntelligence();
          }}
          onSubmit={handleSubmit}
          placeholder="Busque clientes, entregas e filtros"
          value={query}
        />
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  pageTitleBlock: {
    marginBottom: spacing.md,
  },
  resultsScroll: {
    flex: 1,
  },
  searchScrollContent: {
    paddingBottom: spacing.xxl + COMPOSER_COLLAPSED_HEIGHT + spacing.lg,
  },
  searchBody: {
    flex: 1,
    minHeight: 0,
  },
});
