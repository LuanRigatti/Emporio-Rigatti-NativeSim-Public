import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import HomeSearchResultsContent from '@/features/home/components/HomeSearchResultsContent';
import HomeSearchScreenNativeHost from '@/features/home/components/HomeSearchScreenNativeHost';
import type { HomeSearchConversationTurn } from './HomeSearchConversationState';
import { NativeThinkingOrb } from 'native-thinking-orb';
import { useAppTheme } from '@/theme';
import { COMPOSER } from './chatgpt-attachments/constants';
import {
  formatLocalDateAttachment,
  formatLocalDateAttachmentCompact,
} from './chatgpt-attachments/local-date';

function TemporalUserMessageContent({
  selectedDate,
  query,
}: {
  selectedDate: string;
  query: string;
}) {
  const { theme } = useAppTheme();
  const [queryLineCount, setQueryLineCount] = useState(1);
  const dateLabel = formatLocalDateAttachmentCompact(selectedDate);

  return (
    <View
      style={[
        styles.userMessageContent,
        { alignItems: queryLineCount === 1 ? 'center' : 'flex-start', gap: theme.spacing.xs },
      ]}
      testID="sent-message-content"
    >
      <View
        style={[
          styles.sentDateChip,
          {
            backgroundColor: theme.colors.contrastContent,
            paddingHorizontal: theme.spacing.xs,
          },
        ]}
        testID="sent-date-chip"
      >
        <Text
          numberOfLines={1}
          style={[styles.sentDateText, { color: theme.colors.contrastSurface }]}
        >
          {dateLabel}
        </Text>
      </View>
      <Text
        onTextLayout={(event) => {
          const nextLineCount = event.nativeEvent.lines.length;
          setQueryLineCount((currentLineCount) =>
            currentLineCount === nextLineCount ? currentLineCount : nextLineCount,
          );
        }}
        style={[styles.userText, styles.userQueryWithDate, { color: theme.colors.contrastContent }]}
        testID="sent-query-text"
      >
        {query}
      </Text>
    </View>
  );
}

type Props = {
  turns: readonly HomeSearchConversationTurn[];
};

export default function HomeSearchConversation({ turns }: Props) {
  const { reduceMotionEnabled, resolvedMode, theme } = useAppTheme();
  const motionDurations = theme.animations.duration;
  const questionEntryDuration = reduceMotionEnabled
    ? 0
    : motionDurations.standard + motionDurations.fast / 4;
  const loadingEntryDuration = reduceMotionEnabled
    ? 0
    : motionDurations.standard - motionDurations.fast / 8;
  const responseEntryDuration = reduceMotionEnabled
    ? 0
    : motionDurations.slow - motionDurations.fast / 4;
  const responseExitDuration = reduceMotionEnabled ? 0 : motionDurations.fast;
  const responseLayoutDuration = reduceMotionEnabled
    ? 0
    : motionDurations.standard + motionDurations.fast / 4;
  const questionOffset = reduceMotionEnabled ? 0 : 16;
  const loadingOffset = reduceMotionEnabled ? 0 : 9;
  const responseOffset = reduceMotionEnabled ? 0 : 16;

  const turnEntry = FadeInDown.duration(questionEntryDuration)
    .easing(theme.animations.easing.entrance)
    .withInitialValues({ transform: [{ translateY: questionOffset }] });
  const loadingEntry = FadeInDown.duration(loadingEntryDuration)
    .easing(theme.animations.easing.entrance)
    .withInitialValues({ transform: [{ translateY: loadingOffset }] });
  const responseEntry = FadeInDown.duration(responseEntryDuration)
    .easing(theme.animations.easing.entrance)
    .withInitialValues({ transform: [{ translateY: responseOffset }] });
  const responseExit = FadeOut.duration(responseExitDuration).easing(theme.animations.easing.exit);
  const responseLayout = LinearTransition.duration(responseLayoutDuration).easing(
    theme.animations.easing.standard,
  );

  if (turns.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {turns.map((turn) => (
        <View key={turn.id} style={styles.turn}>
          <Animated.View entering={turnEntry} style={styles.userRow}>
            <View
              accessible
              accessibilityLabel={`Pesquisa enviada: ${
                turn.selectedDate
                  ? `${formatLocalDateAttachment(turn.selectedDate)}, ${turn.query}`
                  : turn.query
              }`}
              style={[
                styles.userBubble,
                turn.selectedDate ? { paddingLeft: theme.spacing.xs } : null,
                {
                  backgroundColor: theme.colors.contrastSurface,
                  borderRadius: theme.radius.pill,
                },
              ]}
            >
              {turn.selectedDate ? (
                <TemporalUserMessageContent selectedDate={turn.selectedDate} query={turn.query} />
              ) : (
                <Text style={[styles.userText, { color: theme.colors.contrastContent }]}>
                  {turn.query}
                </Text>
              )}
            </View>
          </Animated.View>

          <Animated.View layout={responseLayout} style={styles.responseSlot}>
            {turn.status === 'loading' ? (
              <Animated.View
                accessible
                accessibilityLabel="Consultando"
                entering={loadingEntry}
                exiting={responseExit}
                key={`${turn.id}-loading`}
                style={styles.responseState}
              >
                <NativeThinkingOrb
                  colorScheme={resolvedMode}
                  fallbackColor={theme.colors.textSecondary}
                  size={20}
                  state="searching"
                />
                <Text style={[styles.responseStateText, { color: theme.colors.textSecondary }]}>
                  Consultando…
                </Text>
              </Animated.View>
            ) : turn.status === 'success' ? (
              <Animated.View
                entering={responseEntry}
                exiting={responseExit}
                key={`${turn.id}-success`}
                style={styles.responseSlot}
              >
                <HomeSearchScreenNativeHost mode="content">
                  <HomeSearchResultsContent
                    isLarge
                    loading={false}
                    response={turn.response}
                    scrollable={false}
                  />
                </HomeSearchScreenNativeHost>
              </Animated.View>
            ) : (
              <Animated.View
                accessible
                accessibilityLabel={turn.message}
                entering={responseEntry}
                exiting={responseExit}
                key={`${turn.id}-${turn.status}`}
                style={styles.responseState}
              >
                <Text style={[styles.responseStateText, { color: theme.colors.textSecondary }]}>
                  {turn.message}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 24,
  },
  turn: {
    width: '100%',
    gap: 12,
  },
  responseSlot: {
    width: '100%',
  },
  userRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  userBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageContent: {
    flexDirection: 'row',
  },
  sentDateChip: {
    maxWidth: COMPOSER.dateChipMaxWidth,
    height: COMPOSER.dateChipHeight,
    borderRadius: COMPOSER.dateChipHeight / 2,
    borderCurve: 'continuous',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sentDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userQueryWithDate: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
  },
  responseState: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  responseStateText: {
    fontSize: 15,
    lineHeight: 21,
  },
});
