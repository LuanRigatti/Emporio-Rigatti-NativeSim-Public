import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { InteractionManager, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useFocusEffect, useNavigation } from 'expo-router';

import { NativeGlassHeader } from '@/components/layout';
import { PremiumScreen } from '@/components/premium';
import { getCardSurfaceColor, spacing, useAppTheme } from '@/theme';
import { prewarmAppleIntelligence } from '../search/AppleIntelligenceSearchInterpreter';
import type { HomeSearchTemporalContext } from '../search/HomeSearchTypes';
import HomeSearchConversation from './HomeSearchConversation';
import {
  homeSearchConversationReducer,
  type HomeSearchConversationTurn,
} from './HomeSearchConversationState';
import HomeSearchResultsContent from './HomeSearchResultsContent';
import HomeSearchHelpContent from '../help/HomeSearchHelpContent';
import HomeSearchAttachmentsComposer from './HomeSearchAttachmentsComposer';
import { COMPOSER_COLLAPSED_HEIGHT } from './chatgpt-attachments/constants';
import { useHomeSearch } from '../hooks/useHomeSearch';
import HomeSearchScreenNativeHost from './HomeSearchScreenNativeHost';

type NativeStackTransitionNavigation = {
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data?: { closing?: boolean } }) => void,
  ) => () => void;
  getParent?: () => NativeStackTransitionNavigation | undefined;
};

export default function HomeSearchScreen() {
  const navigation = useNavigation();
  const { resolvedMode, theme } = useAppTheme();
  const { search } = useHomeSearch();
  const [query, setQuery] = useState('');
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [conversationTurns, dispatchConversation] = useReducer(
    homeSearchConversationReducer,
    [] as HomeSearchConversationTurn[],
  );
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [blurRequestKey, setBlurRequestKey] = useState(0);
  const focusRequestedRef = useRef(false);
  const screenFocusedRef = useRef(false);
  const nextTurnIdRef = useRef(0);
  const scrollToEndRequestedRef = useRef(false);
  const conversationScrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      screenFocusedRef.current = true;
      focusRequestedRef.current = false;
      setSuggestionsVisible(false);

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
    let unsubscribeTransitionEnd: (() => void) | null = null;

    if (parentNavigation) {
      unsubscribeTransitionEnd = nativeStackNavigation.addListener('transitionEnd', (event) => {
        const blockedByClosing = Boolean(event.data?.closing);

        if (blockedByClosing) return;
        requestFocus();
      });
    } else {
      interactionTask = InteractionManager.runAfterInteractions(() => {
        requestFocus();
      });
    }

    return () => {
      unsubscribeTransitionEnd?.();
      interactionTask?.cancel();
    };
  }, [navigation]);

  const handleSubmit = useCallback(
    (value: string, selectedDate?: string): boolean => {
      const nextQuery = value.trim();
      if (!nextQuery) return false;

      const turnId = `search-${nextTurnIdRef.current + 1}`;
      nextTurnIdRef.current += 1;
      scrollToEndRequestedRef.current = true;
      dispatchConversation({
        type: 'submit',
        id: turnId,
        query: nextQuery,
        ...(selectedDate !== undefined ? { selectedDate } : {}),
      });
      setQuery('');

      const temporalContext: HomeSearchTemporalContext | undefined = selectedDate
        ? { selectedDate }
        : undefined;
      const searchRequest = temporalContext
        ? search(nextQuery, temporalContext)
        : search(nextQuery);
      void searchRequest
        .then((nextResponse) => {
          scrollToEndRequestedRef.current = true;

          if (!nextResponse || nextResponse.stale) {
            dispatchConversation({
              type: 'fail',
              id: turnId,
              message: 'A pesquisa foi interrompida. Tente novamente.',
            });
            return;
          }

          dispatchConversation({ type: 'resolve', id: turnId, response: nextResponse });
        })
        .catch(() => {
          scrollToEndRequestedRef.current = true;
          dispatchConversation({
            type: 'fail',
            id: turnId,
            message: 'Não foi possível concluir esta pesquisa agora.',
          });
        });

      return true;
    },
    [search],
  );

  const handleChangeText = useCallback((value: string) => {
    setQuery(value);
    if (value.trim()) setSuggestionsVisible(false);
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
  const showSuggestions =
    suggestionsVisible && conversationTurns.length === 0 && query.trim().length === 0;
  const isLatestTurnLoading = conversationTurns[conversationTurns.length - 1]?.status === 'loading';

  const handleConversationContentSizeChange = useCallback(() => {
    if (!scrollToEndRequestedRef.current) return;

    scrollToEndRequestedRef.current = false;
    conversationScrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={
            showSuggestions ? 'Ocultar sugestões de pesquisa' : 'Mostrar sugestões de pesquisa'
          }
          icon="questionmark.circle"
          onPress={() => setSuggestionsVisible((visible) => !visible)}
        />
      </Stack.Toolbar>
      <PremiumScreen
        contentContainerStyle={{
          paddingBottom: 0,
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
            contentContainerStyle={[
              styles.searchScrollContent,
              isLatestTurnLoading ? styles.loadingSearchScrollContent : null,
            ]}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={handleConversationContentSizeChange}
            ref={conversationScrollRef}
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
            ) : conversationTurns.length > 0 ? (
              <HomeSearchConversation turns={conversationTurns} />
            ) : (
              <HomeSearchScreenNativeHost mode="content">
                <HomeSearchResultsContent
                  isLarge
                  loading={false}
                  response={null}
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
    </>
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
  loadingSearchScrollContent: {
    flexGrow: 1,
  },
  searchBody: {
    flex: 1,
    minHeight: 0,
  },
});
