import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import HomeSearchConversation from '@/features/home/components/HomeSearchConversation';
import type { HomeSearchConversationTurn } from '@/features/home/components/HomeSearchConversationState';
import { formatLocalDateAttachmentCompact } from '@/features/home/components/chatgpt-attachments/local-date';

let mockResolvedMode: 'light' | 'dark' = 'light';

jest.mock('react-native-reanimated', () => {
  const { View: NativeView } = jest.requireActual('react-native');
  const chain = { easing: () => chain, withInitialValues: () => chain };
  return {
    __esModule: true,
    default: { View: NativeView },
    View: NativeView,
    FadeInDown: { duration: () => chain },
    FadeOut: { duration: () => chain },
    LinearTransition: { duration: () => chain },
    Easing: { out: (value: unknown) => value, poly: () => () => undefined, quad: {} },
  };
});

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    reduceMotionEnabled: false,
    resolvedMode: mockResolvedMode,
    theme: {
      animations: {
        duration: { fast: 100, standard: 200, slow: 300 },
        easing: { entrance: 'entrance', exit: 'exit', standard: 'standard' },
      },
      colors: {
        contrastContent: mockResolvedMode === 'dark' ? '#000000' : '#FFFFFF',
        contrastSurface: mockResolvedMode === 'dark' ? '#FFFFFF' : '#000000',
        textPrimary: '#14171F',
        textSecondary: '#667085',
      },
      radius: { lg: 16, pill: 999 },
      spacing: { xs: 8 },
    },
  }),
}));

jest.mock('native-thinking-orb', () => ({
  __esModule: true,
  NativeThinkingOrb: ({ state, size, colorScheme, fallbackColor }: Record<string, unknown>) =>
    jest
      .requireActual<typeof React>('react')
      .createElement(
        jest.requireActual<typeof import('react-native')>('react-native').Text,
        { testID: 'native-thinking-orb' },
        [state, size, colorScheme, fallbackColor].join('|'),
      ),
}));

jest.mock('@/features/home/components/HomeSearchResultsContent', () => ({
  __esModule: true,
  default: () =>
    jest
      .requireActual<typeof React>('react')
      .createElement(jest.requireActual<typeof import('react-native')>('react-native').View),
}));

jest.mock('@/features/home/components/HomeSearchScreenNativeHost', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) =>
    jest
      .requireActual<typeof React>('react')
      .createElement(
        jest.requireActual<typeof import('react-native')>('react-native').View,
        null,
        children,
      ),
}));

function loadingTurn(query: string, selectedDate?: string): HomeSearchConversationTurn {
  return {
    id: 'turn-1',
    query,
    ...(selectedDate !== undefined ? { selectedDate } : {}),
    status: 'loading',
    response: null,
  };
}

function findMessageContentRow(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByProps({ testID: 'sent-message-content' })
    .find((instance) => StyleSheet.flatten(instance.props.style)?.flexDirection === 'row')!;
}

describe('HomeSearchConversation temporal attachment presentation', () => {
  let renderer!: ReactTestRenderer;

  beforeEach(() => {
    mockResolvedMode = 'light';
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer.unmount());
    }
  });

  it('keeps the bubble content unchanged when there is no temporal attachment', () => {
    act(() => {
      renderer = create(
        React.createElement(HomeSearchConversation, {
          turns: [loadingTurn('Pergunta sem data')],
        }),
      );
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Pesquisa enviada: Pergunta sem data' }),
    ).toBeTruthy();
    const bubble = renderer.root.findByProps({
      accessibilityLabel: 'Pesquisa enviada: Pergunta sem data',
    });
    expect(StyleSheet.flatten(bubble.props.style).borderRadius).toBe(999);
    expect(renderer.root.findAllByProps({ testID: 'sent-message-content' })).toHaveLength(0);
    const bubbleText = renderer.root.findByProps({ children: 'Pergunta sem data' });
    expect(StyleSheet.flatten(bubbleText.props.style)).toMatchObject({
      fontSize: 16,
      lineHeight: 22,
      color: '#FFFFFF',
    });
  });

  it('shows the searching orb and keeps the current loading label', () => {
    act(() => {
      renderer = create(
        React.createElement(HomeSearchConversation, {
          turns: [loadingTurn('Consulta')],
        }),
      );
    });

    expect(renderer.root.findByProps({ testID: 'native-thinking-orb' }).props.children).toBe(
      'searching|20|light|#667085',
    );
    expect(renderer.root.findByProps({ accessibilityLabel: 'Consultando' })).toBeTruthy();
    expect(renderer.root.findByProps({ children: 'Consultando…' })).toBeTruthy();

    mockResolvedMode = 'dark';
    act(() => {
      renderer.update(
        React.createElement(HomeSearchConversation, {
          turns: [loadingTurn('Consulta')],
        }),
      );
    });
    expect(renderer.root.findByProps({ testID: 'native-thinking-orb' }).props.children).toBe(
      'searching|20|dark|#667085',
    );
  });

  it('does not keep the orb mounted after loading resolves or fails', () => {
    const terminalTurns = [
      {
        id: 'success',
        query: 'Concluída',
        status: 'success',
        response: {},
      },
      {
        id: 'error',
        query: 'Falhou',
        status: 'error',
        response: null,
        message: 'Falha de teste',
      },
    ] as HomeSearchConversationTurn[];

    act(() => {
      renderer = create(React.createElement(HomeSearchConversation, { turns: terminalTurns }));
    });

    expect(renderer.root.findAllByProps({ testID: 'native-thinking-orb' })).toHaveLength(0);
  });

  it('shows the shared compact date format before the original question and keeps full accessibility context', () => {
    act(() => {
      renderer = create(
        React.createElement(HomeSearchConversation, {
          turns: [loadingTurn('Faturamento nesse dia?', '2026-09-23')],
        }),
      );
    });

    const bubble = renderer.root.findByProps({
      accessibilityLabel: 'Pesquisa enviada: 23 set 2026, Faturamento nesse dia?',
    });
    expect(StyleSheet.flatten(bubble.props.style)).toMatchObject({
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingLeft: 8,
    });
    const content = findMessageContentRow(renderer);
    const serializedBubble = JSON.stringify(renderer.toJSON());
    expect(serializedBubble.indexOf('sent-date-chip')).toBeLessThan(
      serializedBubble.indexOf('sent-query-text'),
    );
    const dateText = renderer.root.findByProps({ testID: 'sent-date-chip' }).findByType(Text);
    expect(dateText.props.children).toBe('23/09');
    expect(dateText.props.children).toBe(formatLocalDateAttachmentCompact('2026-09-23'));
    expect(renderer.root.findByProps({ testID: 'sent-query-text' }).props.children).toBe(
      'Faturamento nesse dia?',
    );
    expect(StyleSheet.flatten(dateText.props.style)).toMatchObject({
      fontSize: 12,
      fontWeight: '600',
    });
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Remover data 22 set 2026' }),
    ).toHaveLength(0);
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    });
    expect(
      StyleSheet.flatten(renderer.root.findByProps({ testID: 'sent-date-chip' }).props.style),
    ).toMatchObject({
      height: 32,
      borderRadius: 16,
      flexShrink: 0,
    });
    expect(bubble.props.accessibilityLabel).toContain('23 set 2026');
  });

  it('lets long questions wrap and aligns the date with the first line', () => {
    act(() => {
      renderer = create(
        React.createElement(HomeSearchConversation, {
          turns: [
            loadingTurn(
              'Qual foi o faturamento desse dia e quais foram os principais valores?',
              '2026-09-22',
            ),
          ],
        }),
      );
    });

    const queryText = renderer.root.findByProps({ testID: 'sent-query-text' });
    // Verify the style contract only; react-test-renderer does not resolve native layout frames.
    expect(StyleSheet.flatten(queryText.props.style)).toMatchObject({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      fontSize: 16,
      lineHeight: 22,
    });
    expect(queryText.props.numberOfLines).toBeUndefined();

    act(() => {
      queryText.props.onTextLayout({ nativeEvent: { lines: [{}, {}] } });
    });

    expect(StyleSheet.flatten(findMessageContentRow(renderer).props.style).alignItems).toBe(
      'flex-start',
    );
  });

  it('uses bubble-relative chip colors in light and dark appearance', () => {
    act(() => {
      renderer = create(
        React.createElement(HomeSearchConversation, {
          turns: [loadingTurn('Pergunta', '2026-09-22')],
        }),
      );
    });

    const bubble = () =>
      renderer.root.findByProps({
        accessibilityLabel: 'Pesquisa enviada: 22 set 2026, Pergunta',
      });
    const chip = () => renderer.root.findByProps({ testID: 'sent-date-chip' });
    const dateLabel = () => chip().findByType(Text);
    const queryText = () => renderer.root.findByProps({ testID: 'sent-query-text' });

    expect(StyleSheet.flatten(bubble().props.style).backgroundColor).toBe('#000000');
    expect(StyleSheet.flatten(chip().props.style).backgroundColor).toBe('#FFFFFF');
    expect(StyleSheet.flatten(dateLabel().props.style).color).toBe('#000000');
    expect(StyleSheet.flatten(queryText().props.style).color).toBe('#FFFFFF');

    mockResolvedMode = 'dark';
    act(() => {
      renderer.update(
        React.createElement(HomeSearchConversation, {
          turns: [loadingTurn('Pergunta', '2026-09-22')],
        }),
      );
    });
    expect(StyleSheet.flatten(bubble().props.style).backgroundColor).toBe('#FFFFFF');
    expect(StyleSheet.flatten(chip().props.style).backgroundColor).toBe('#000000');
    expect(StyleSheet.flatten(dateLabel().props.style).color).toBe('#FFFFFF');
    expect(StyleSheet.flatten(queryText().props.style).color).toBe('#000000');
  });
});
