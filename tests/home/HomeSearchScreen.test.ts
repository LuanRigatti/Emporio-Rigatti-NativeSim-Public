import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Keyboard, Text, View } from 'react-native';

import type { HomeSearchResponse } from '@/features/home/search/HomeSearchTypes';
import HomeSearchScreen from '@/features/home/components/HomeSearchScreen';

const mockSearch = jest.fn();
const mockReact = React;
const mockText = Text;
const mockView = View;
const keyboardDismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);

jest.mock('react-native-reanimated', () => ({
  default: { View: mockView },
  FadeInDown: {
    duration: jest.fn(() => ({
      easing: jest.fn(() => ({ withInitialValues: jest.fn() })),
    })),
  },
  FadeOut: {
    duration: jest.fn(() => ({ easing: jest.fn() })),
  },
  Easing: {
    out: jest.fn((value: unknown) => value),
    poly: jest.fn(() => (value: unknown) => value),
    quad: {},
  },
  LinearTransition: {
    duration: jest.fn(() => ({ easing: jest.fn() })),
  },
}));

jest.mock('expo-router', () => ({
  Stack: {
    Toolbar: Object.assign(
      ({ children }: { children?: React.ReactNode }) =>
        mockReact.createElement(mockView, { testID: 'toolbar-right' }, children),
      {
        Button: (props: Record<string, unknown>) =>
          mockReact.createElement(mockView, { testID: 'suggestions-toggle', ...props }),
      },
    ),
  },
  useFocusEffect: jest.fn(),
  useNavigation: () => ({}),
}));

jest.mock('@/providers', () => ({}));

jest.mock('@/theme', () => ({
  getCardSurfaceColor: jest.fn(() => '#FFFFFF'),
  radius: { lg: 16 },
  spacing: { lg: 20, md: 16, xxl: 40 },
  useAppTheme: () => ({
    reduceMotionEnabled: false,
    resolvedMode: 'light',
    theme: {
      animations: {
        duration: { fast: 160 },
        easing: { entrance: 'entrance', exit: 'exit', standard: 'standard' },
      },
      colors: {
        contrastContent: '#FFFFFF',
        contrastSurface: '#000000',
        surface: '#FFFFFF',
        textSecondary: '#667085',
      },
      layout: { screenHorizontalPadding: 16 },
      radius: { lg: 16 },
      sizes: { touchTargetMinimum: 44 },
      spacing: { lg: 20, xl: 32, xxl: 40, xxs: 2 },
    },
  }),
}));

jest.mock('@/components/layout', () => ({
  NativeGlassHeader: (props: { title?: string }) => {
    return mockReact.createElement(
      mockView,
      { testID: 'header' },
      mockReact.createElement(mockText, null, props.title),
    );
  },
}));

jest.mock('@/components/premium', () => ({
  PremiumScreen: ({ children }: { children: React.ReactNode }) => {
    return mockReact.createElement(mockView, null, children);
  },
}));

jest.mock('@/features/home/search/AppleIntelligenceSearchInterpreter', () => ({
  prewarmAppleIntelligence: jest.fn(),
}));

jest.mock('@/features/home/hooks/useHomeSearch', () => ({
  useHomeSearch: () => ({ search: mockSearch }),
}));

jest.mock('@/features/home/components/HomeSearchConversation', () => ({
  __esModule: true,
  default: ({
    turns,
  }: {
    turns: {
      id: string;
      query: string;
      selectedDate?: string;
      status: string;
      response?: HomeSearchResponse;
      message?: string;
    }[];
  }) =>
    mockReact.createElement(
      mockView,
      { testID: 'conversation', turns } as React.ComponentProps<typeof View>,
      turns.map((turn) =>
        mockReact.createElement(
          mockReact.Fragment,
          {
            key: turn.id,
          },
          mockReact.createElement(mockView, {
            accessibilityLabel: `Pesquisa enviada: ${turn.query}`,
          }),
          turn.status === 'loading'
            ? mockReact.createElement(mockView, { accessibilityLabel: 'Consultando' })
            : turn.status === 'success'
              ? mockReact.createElement(
                  mockView,
                  { testID: 'search-result' },
                  mockReact.createElement(mockText, null, turn.response?.query.original),
                )
              : mockReact.createElement(mockView, { accessibilityLabel: turn.message }),
        ),
      ),
    ),
}));

jest.mock('@/features/home/help/HomeSearchHelpContent', () => ({
  __esModule: true,
  default: (props: { onSelectQuery: (query: string) => void }) =>
    mockReact.createElement(mockView, { testID: 'suggestions-card', ...props }),
}));

jest.mock('@/features/home/components/HomeSearchScreenNativeHost', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/home/components/HomeSearchResultsContent', () => ({
  __esModule: true,
  default: ({ response }: { response: HomeSearchResponse | null }) => {
    return mockReact.createElement(
      mockView,
      { testID: 'search-result' },
      mockReact.createElement(mockText, null, response?.query.original ?? ''),
    );
  },
}));

jest.mock('@/features/home/components/HomeSearchAttachmentsComposer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    return mockReact.createElement(mockView, { testID: 'composer', ...props });
  },
}));

function response(query: string): HomeSearchResponse {
  return {
    query: { original: query } as HomeSearchResponse['query'],
    results: [],
    counts: {} as HomeSearchResponse['counts'],
    coverage: [],
    errors: [],
    durationMs: 1,
    stale: false,
  };
}

describe('HomeSearchScreen conversation presentation', () => {
  beforeEach(() => {
    mockSearch.mockReset();
    keyboardDismissSpy.mockClear();
  });

  it('starts with suggestions closed and toggles the existing card from the native toolbar', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(React.createElement(HomeSearchScreen));
    });

    const toggle = renderer.root.findByProps({ testID: 'suggestions-toggle' });
    expect(toggle.props.icon).toBe('questionmark.circle');
    expect(toggle.props.accessibilityLabel).toBe('Mostrar sugestões de pesquisa');
    expect(renderer.root.findAllByProps({ testID: 'suggestions-card' })).toHaveLength(0);

    await act(async () => {
      toggle.props.onPress();
    });

    expect(toggle.props.accessibilityLabel).toBe('Ocultar sugestões de pesquisa');
    expect(renderer.root.findByProps({ testID: 'suggestions-card' })).toBeTruthy();

    await act(async () => {
      toggle.props.onPress();
    });

    expect(toggle.props.accessibilityLabel).toBe('Mostrar sugestões de pesquisa');
    expect(renderer.root.findAllByProps({ testID: 'suggestions-card' })).toHaveLength(0);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps the existing suggestion handler and composer value while toggling visibility', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(React.createElement(HomeSearchScreen));
    });

    const toggle = renderer.root.findByProps({ testID: 'suggestions-toggle' });
    await act(async () => {
      toggle.props.onPress();
    });

    const card = renderer.root.findByProps({ testID: 'suggestions-card' });
    const suggestionHandler = card.props.onSelectQuery;
    const composer = renderer.root.findByProps({ testID: 'composer' });
    await act(async () => {
      composer.props.onChangeText('resumo');
    });

    expect(composer.props.value).toBe('resumo');
    expect(renderer.root.findAllByProps({ testID: 'suggestions-card' })).toHaveLength(0);

    await act(async () => {
      toggle.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'suggestions-card' })).toHaveLength(0);

    expect(suggestionHandler).toBeInstanceOf(Function);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('clears the composer, shows the submitted query and keeps sequential responses', async () => {
    let resolveFirst!: (value: HomeSearchResponse) => void;
    let resolveSecond!: (value: HomeSearchResponse) => void;
    mockSearch
      .mockReturnValueOnce(new Promise<HomeSearchResponse>((resolve) => (resolveFirst = resolve)))
      .mockReturnValueOnce(new Promise<HomeSearchResponse>((resolve) => (resolveSecond = resolve)));

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(React.createElement(HomeSearchScreen));
    });

    let composer = renderer.root.findByProps({ testID: 'composer' });
    await act(async () => {
      composer.props.onChangeText('primeira pesquisa');
      composer.props.onSubmit('primeira pesquisa');
    });

    expect(composer.props.value).toBe('');
    expect(keyboardDismissSpy).not.toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Pesquisa enviada: primeira pesquisa' }),
    ).toBeTruthy();
    expect(renderer.root.findByProps({ accessibilityLabel: 'Consultando' })).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith('primeira pesquisa');

    await act(async () => {
      resolveFirst(response('primeira pesquisa'));
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: 'search-result' })).toBeTruthy();

    composer = renderer.root.findByProps({ testID: 'composer' });
    await act(async () => {
      composer.props.onChangeText('segunda pesquisa');
      composer.props.onSubmit('segunda pesquisa');
    });
    expect(composer.props.value).toBe('');

    await act(async () => {
      resolveSecond(response('segunda pesquisa'));
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Pesquisa enviada: primeira pesquisa' }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Pesquisa enviada: segunda pesquisa' }),
    ).toBeTruthy();
    const serializedTree = JSON.stringify(renderer.toJSON());
    expect(serializedTree).toContain('primeira pesquisa');
    expect(serializedTree).toContain('segunda pesquisa');
    expect(mockSearch).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('passes the date attachment separately while keeping the submitted question unchanged', async () => {
    mockSearch.mockResolvedValueOnce(response('Quanto eu faturei?'));

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(React.createElement(HomeSearchScreen));
    });

    const composer = renderer.root.findByProps({ testID: 'composer' });
    await act(async () => {
      composer.props.onSubmit('Quanto eu faturei?', '2026-09-22');
      await Promise.resolve();
    });

    expect(mockSearch).toHaveBeenCalledWith('Quanto eu faturei?', {
      selectedDate: '2026-09-22',
    });
    expect(renderer.root.findByProps({ testID: 'conversation' }).props.turns[0]).toMatchObject({
      query: 'Quanto eu faturei?',
      selectedDate: '2026-09-22',
    });
    mockSearch.mockResolvedValueOnce(response('Consulta sem data'));
    const composerAfterFirstSubmit = renderer.root.findByProps({ testID: 'composer' });
    await act(async () => {
      composerAfterFirstSubmit.props.onSubmit('Consulta sem data');
      await Promise.resolve();
    });
    expect(mockSearch).toHaveBeenNthCalledWith(2, 'Consulta sem data');
    const turns = renderer.root.findByProps({ testID: 'conversation' }).props.turns;
    expect(turns[0].selectedDate).toBe('2026-09-22');
    expect(turns[1]).not.toHaveProperty('selectedDate');

    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps an error attached to the submitted query without exposing an internal error', async () => {
    mockSearch.mockRejectedValueOnce(new Error('internal data source details'));

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(React.createElement(HomeSearchScreen));
    });

    const composer = renderer.root.findByProps({ testID: 'composer' });
    await act(async () => {
      composer.props.onSubmit('consulta com erro');
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Pesquisa enviada: consulta com erro' }),
    ).toBeTruthy();
    expect(
      renderer.root.findByProps({
        accessibilityLabel: 'Não foi possível concluir esta pesquisa agora.',
      }),
    ).toBeTruthy();
    expect(renderer.root.findAllByProps({ children: 'internal data source details' })).toHaveLength(
      0,
    );

    await act(async () => {
      renderer.unmount();
    });
  });
});
