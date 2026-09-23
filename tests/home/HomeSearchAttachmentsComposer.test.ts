import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text, View } from 'react-native';
import HomeSearchAttachmentsComposer from '@/features/home/components/HomeSearchAttachmentsComposer';
import {
  ATTACHMENT_CONTROL_GLASS_TINT,
  BOTTOM_BAR,
} from '@/features/home/components/chatgpt-attachments/constants';
import { triggerNativeButtonHaptic } from '@/utils/haptics';
import {
  formatLocalDateAttachment,
  formatLocalDateAttachmentCompact,
  localDateKey,
} from '@/features/home/components/chatgpt-attachments/local-date';

const mockReact = React;
const mockPressable = Pressable;
const mockText = Text;
const mockView = View;
const mockFormatLocalDateAttachment = formatLocalDateAttachment;
const mockFormatLocalDateAttachmentCompact = formatLocalDateAttachmentCompact;
let mockSetAttachmentPanelState:
  ((state: { closing: boolean; mode: string; sheet: string }) => void) | undefined;
let mockPanelDismissCount = 0;

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));
jest.mock('react-native-keyboard-controller', () => ({
  OverKeyboardView: ({ children }: { children: React.ReactNode }) =>
    mockReact.createElement(mockView, null, children),
}));
jest.mock('react-native-reanimated', () => {
  const actualReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    View: actualReactNative.View,
    default: { View: actualReactNative.View },
    Easing: {
      out: (value: unknown) => value,
      poly: () => (value: unknown) => value,
      quad: {},
    },
  };
});
jest.mock('@/utils/haptics', () => ({ triggerNativeButtonHaptic: jest.fn() }));
jest.mock('@/features/home/components/chatgpt-attachments/glass', () => ({
  Glass: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    mockReact.createElement('GlassMock', props, children),
}));
jest.mock('@/theme', () => ({
  registrarDeliveryDarkLiquidGlassTint: 'dark-glass-tint',
  useAppTheme: () => ({
    resolvedMode: 'dark',
    theme: {
      colors: {
        primary: '#0A84FF',
        selectionContent: '#000000',
        selectionSurface: '#FFFFFF',
        textInverse: '#FFFFFF',
        textPrimary: '#FFFFFF',
        textSecondary: '#AAAAAA',
      },
      spacing: { sm: 8 },
      typography: { caption: {}, headline: {}, subheadline: {} },
    },
  }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/camera/camera-bar', () => ({
  CameraBar: () => mockReact.createElement(mockView, { testID: 'camera-controls' }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/camera/camera-sheet', () => {
  const actualReact = jest.requireActual<typeof React>('react');
  return {
    CameraSheet: actualReact.forwardRef((_props, _ref) =>
      actualReact.createElement(mockView, { testID: 'camera-preview' }),
    ),
  };
});
jest.mock('@/features/home/components/chatgpt-attachments/composer/attachment-flight', () => ({
  AttachmentFlight: () => null,
}));
jest.mock('@/features/home/components/chatgpt-attachments/composer/composer', () => ({
  Composer: ({
    dateAttachment,
    onPlusPress,
    onRemoveDateAttachment,
    onSubmit,
  }: {
    dateAttachment?: string;
    onPlusPress: () => void;
    onRemoveDateAttachment: () => void;
    onSubmit: (value: string) => boolean;
  }) =>
    mockReact.createElement(
      'ComposerMock',
      { dateAttachment, onPlusPress, onRemoveDateAttachment, onSubmit, testID: 'composer' },
      dateAttachment
        ? mockReact.createElement(
            mockView,
            {
              accessibilityLabel: `Data anexada: ${mockFormatLocalDateAttachment(dateAttachment)}`,
              testID: 'date-attachment',
            },
            mockReact.createElement(
              mockText,
              null,
              mockFormatLocalDateAttachmentCompact(dateAttachment),
            ),
            mockReact.createElement(mockPressable, {
              accessibilityLabel: 'Remover data anexada',
              onPress: onRemoveDateAttachment,
            }),
          )
        : null,
    ),
}));
jest.mock('@/features/home/components/chatgpt-attachments/panel/attachment-menu', () => ({
  AttachmentMenu: ({ onSelect }: { onSelect: (action: string) => void }) =>
    mockReact.createElement(
      mockView,
      null,
      ...[
        ['Câmera', 'camera'],
        ['Fotos', 'photos'],
        ['Data', 'date'],
        ['Arquivos', 'files'],
      ].map(([label, action]) =>
        mockReact.createElement(
          mockPressable,
          {
            accessibilityLabel: label,
            key: action,
            onPress: () => onSelect(action),
          },
          mockReact.createElement(mockText, null, label),
        ),
      ),
    ),
}));
jest.mock('@/features/home/components/chatgpt-attachments/panel/attachment-panel', () => ({
  AttachmentPanel: ({
    interactive,
    menu,
    grid,
  }: {
    interactive: 'menu' | 'grid' | 'none';
    menu: React.ReactNode;
    grid: React.ReactNode;
  }) =>
    mockReact.createElement(
      mockView,
      { testID: 'attachment-panel' },
      interactive === 'menu' ? menu : grid,
    ),
}));
jest.mock('@/features/home/components/chatgpt-attachments/panel/sheet-bar', () => ({
  SheetBar: ({ children, onBack }: { children: React.ReactNode; onBack: () => void }) =>
    mockReact.createElement(
      mockView,
      { testID: 'sheet-bar' },
      mockReact.createElement(mockPressable, {
        accessibilityLabel: 'Voltar ao menu',
        onPress: onBack,
      }),
      children,
    ),
}));
jest.mock('@/features/home/components/chatgpt-attachments/photos/photo-grid', () => {
  const actualReact = jest.requireActual<typeof React>('react');
  return {
    PhotoGrid: actualReact.forwardRef((_props, _ref) =>
      actualReact.createElement(mockView, { testID: 'photo-grid' }),
    ),
  };
});
jest.mock('@/features/home/components/chatgpt-attachments/photos/photo-grid-bar', () => ({
  PhotoGridBar: () => mockReact.createElement(mockView, { testID: 'photo-controls' }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/photos/use-photo-library', () => ({
  usePhotoLibrary: () => ({ photos: [], status: 'empty' }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/use-attachment-flights', () => ({
  useAttachmentFlights: () => ({
    addAttachments: jest.fn(),
    attach: jest.fn(),
    attachAndLeave: jest.fn(),
    attachments: [],
    flights: [],
    isFlying: false,
    removeAttachment: jest.fn(),
    strip: { get: () => 0, set: jest.fn() },
  }),
}));
jest.mock('@/features/home/components/chatgpt-attachments/use-attachment-panel', () => {
  const actualReact = jest.requireActual<typeof React>('react');
  return {
    useAttachmentPanel: ({ onLeaveSheet }: { onLeaveSheet: () => void }) => {
      const [mode, setMode] = actualReact.useState('closed');
      const [sheet, setSheet] = actualReact.useState('photos');
      const [closing, setClosing] = actualReact.useState(false);
      mockSetAttachmentPanelState = (state) => {
        setMode(state.mode);
        setSheet(state.sheet);
        setClosing(state.closing);
      };
      const dismiss = () => {
        mockPanelDismissCount += 1;
        onLeaveSheet();
        setClosing(true);
      };
      const shared = { get: () => 0, set: jest.fn() };
      return {
        backToMenu: () => {
          onLeaveSheet();
          setClosing(false);
          setMode('menu');
        },
        blur: shared,
        closing,
        dismiss,
        gridOpacity: shared,
        menuOpacity: shared,
        mode,
        morph: shared,
        onMenuAction: (action: string) => {
          setSheet(action);
          setClosing(false);
          setMode(action);
        },
        onPlusPress: () => {
          if (mode === 'closed') {
            setClosing(false);
            setMode('menu');
          } else {
            dismiss();
          }
        },
        open: shared,
        plusOut: shared,
        resetAfterLeave: jest.fn(),
        sheet,
      };
    },
  };
});
jest.mock('@/features/home/components/chatgpt-attachments/use-sheet-geometry', () => ({
  useSheetGeometry: () => ({
    composerBottom: { get: () => 700 },
    composerStyle: {},
    gridHeight: 600,
    gridWidth: 360,
    height: 800,
    width: 360,
  }),
}));

describe('HomeSearchAttachmentsComposer temporal attachment', () => {
  let renderer: ReactTestRenderer;
  const onSubmit = jest.fn(() => true);

  const mountComposer = (blurRequestKey = 0) => {
    act(() => {
      renderer = create(
        mockReact.createElement(HomeSearchAttachmentsComposer, {
          blurRequestKey,
          focusRequestKey: 0,
          onChangeText: jest.fn(),
          onFocusChange: jest.fn(),
          onSubmit,
          placeholder: 'Pesquisar',
          value: 'Quanto eu faturei?',
        }),
      );
    });
  };

  const openCalendar = () => {
    const composer = renderer.root.findByProps({ testID: 'composer' });
    act(() => composer.props.onPlusPress());
    act(() => renderer.root.findByProps({ accessibilityLabel: 'Data' }).props.onPress());
    return renderer.root;
  };

  const setPanelState = (state: { closing: boolean; mode: string; sheet: string }) => {
    if (!mockSetAttachmentPanelState) throw new Error('Attachment panel state is not mounted.');
    act(() => mockSetAttachmentPanelState?.(state));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 22, 12));
    onSubmit.mockClear();
    jest.mocked(triggerNativeButtonHaptic).mockClear();
    mockPanelDismissCount = 0;
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer.unmount());
    }
    jest.useRealTimers();
  });

  it('confirms the selected day and removes the footer as soon as dismiss starts', () => {
    mountComposer();
    openCalendar();

    const day = renderer.root.findByProps({ accessibilityLabel: '24 de Setembro de 2026' });
    act(() => day.props.onPress());

    expect(
      renderer.root.findByProps({ accessibilityLabel: '24 de Setembro de 2026' }).props
        .accessibilityState,
    ).toEqual({ selected: true });

    const footer = renderer.root.findByProps({ testID: 'sheet-bar' });
    expect(footer.findByProps({ accessibilityLabel: 'Voltar ao menu' })).toBeTruthy();
    expect(footer.findByProps({ testID: 'calendar-confirm-action' })).toBeTruthy();
    const confirmSlot = footer.findByProps({ testID: 'calendar-confirm-slot' });
    expect(confirmSlot.props.pointerEvents).toBe('box-none');
    expect(confirmSlot.props.style).toMatchObject({
      alignItems: 'flex-end',
      flex: 1,
      height: '100%',
      justifyContent: 'center',
    });
    const confirm = footer.findByProps({ testID: 'calendar-confirm-action' });
    expect(confirm.props.accessibilityRole).toBe('button');
    expect(confirm.props.accessibilityLabel).toBe('Selecionar');
    const glass = confirm.findByProps({ testID: 'calendar-confirm-glass' });
    expect(glass.props.radius).toBe(BOTTOM_BAR.controlSize / 2);
    expect(glass.props.active).toBe(true);
    expect(glass.props.tintColor).toBe(ATTACHMENT_CONTROL_GLASS_TINT);
    expect(glass.props.fallbackTint).toBe(ATTACHMENT_CONTROL_GLASS_TINT);
    expect(glass.props.style).toMatchObject({
      width: 120,
      height: BOTTOM_BAR.controlSize,
    });
    const label = confirm.findByType(Text);
    expect(label.props.children).toBe('Selecionar');
    expect(label.props.style).toMatchObject({
      color: '#FFFFFF',
      fontSize: BOTTOM_BAR.pillLabelSize,
      fontWeight: '600',
    });
    act(() => confirm.props.onPress());

    expect(triggerNativeButtonHaptic).toHaveBeenCalledWith('selection');
    expect(mockPanelDismissCount).toBe(1);
    expect(renderer.root.findAllByProps({ testID: 'sheet-bar' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'composer' }).props.dateAttachment).toBe(
      '2026-09-24',
    );
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Data anexada: 24 set 2026' }),
    ).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ['active date mode', { closing: false, mode: 'date', sheet: 'date' }, true],
    ['closing date mode', { closing: true, mode: 'date', sheet: 'date' }, false],
    ['menu mode with stale date sheet', { closing: false, mode: 'menu', sheet: 'date' }, false],
    ['closed mode with stale date sheet', { closing: false, mode: 'closed', sheet: 'date' }, false],
  ])('mounts the date footer only for %s', (_label, state, isActive) => {
    mountComposer();
    openCalendar();
    setPanelState(state);

    if (isActive) {
      const footer = renderer.root.findByProps({ accessibilityLabel: 'Selecionar' });
      expect(footer).toBeTruthy();
      expect(renderer.root.findByProps({ accessibilityLabel: 'Voltar ao menu' })).toBeTruthy();
    } else {
      expect(renderer.root.findAllByProps({ testID: 'sheet-bar' })).toHaveLength(0);
    }
    expect(renderer.root.findAllByProps({ testID: 'photo-controls' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'camera-controls' })).toHaveLength(0);
  });

  it('removes the date footer immediately on Back without falling through to another footer', () => {
    mountComposer();
    openCalendar();

    act(() => renderer.root.findByProps({ accessibilityLabel: 'Voltar ao menu' }).props.onPress());

    expect(renderer.root.findAllByProps({ testID: 'sheet-bar' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'photo-controls' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'camera-controls' })).toHaveLength(0);
    expect(renderer.root.findByProps({ accessibilityLabel: 'Câmera' })).toBeTruthy();
  });

  it('removes the date chip and includes the date in a submitted search before resetting it', () => {
    mountComposer();
    openCalendar();
    act(() =>
      renderer.root.findByProps({ accessibilityLabel: '23 de Setembro de 2026' }).props.onPress(),
    );
    act(() => renderer.root.findByProps({ testID: 'calendar-confirm-action' }).props.onPress());

    const composerWithDate = renderer.root.findByProps({ testID: 'composer' });
    expect(composerWithDate.props.dateAttachment).toBe('2026-09-23');
    const attachedDate = renderer.root.findByProps({ testID: 'date-attachment' });
    expect(attachedDate.findByType(Text).props.children).toBe('23/09');
    expect(attachedDate.props.accessibilityLabel).toBe('Data anexada: 23 set 2026');
    act(() => composerWithDate.props.onSubmit('Quanto eu faturei?'));
    expect(onSubmit).toHaveBeenCalledWith('Quanto eu faturei?', '2026-09-23');
    expect(renderer.root.findByProps({ testID: 'composer' }).props.dateAttachment).toBeUndefined();

    setPanelState({ closing: false, mode: 'closed', sheet: 'date' });
    openCalendar();
    expect(
      renderer.root.findByProps({ accessibilityLabel: '22 de Setembro de 2026' }).props
        .accessibilityState,
    ).toEqual({ selected: true });
    act(() =>
      renderer.root.findByProps({ accessibilityLabel: '23 de Setembro de 2026' }).props.onPress(),
    );
    act(() => renderer.root.findByProps({ testID: 'calendar-confirm-action' }).props.onPress());
    act(() =>
      renderer.root.findByProps({ accessibilityLabel: 'Remover data anexada' }).props.onPress(),
    );
    expect(renderer.root.findByProps({ testID: 'composer' }).props.dateAttachment).toBeUndefined();
  });

  it('clears the attachment when the route requests composer blur', () => {
    mountComposer();
    openCalendar();
    act(() => renderer.root.findByProps({ testID: 'calendar-confirm-action' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'composer' }).props.dateAttachment).toBe(
      '2026-09-22',
    );

    act(() =>
      renderer.update(
        mockReact.createElement(HomeSearchAttachmentsComposer, {
          blurRequestKey: 1,
          focusRequestKey: 0,
          onChangeText: jest.fn(),
          onFocusChange: jest.fn(),
          onSubmit,
          placeholder: 'Pesquisar',
          value: 'Quanto eu faturei?',
        }),
      ),
    );

    expect(renderer.root.findByProps({ testID: 'composer' }).props.dateAttachment).toBeUndefined();
  });

  it('keeps the existing camera and gallery attachment routes available', () => {
    mountComposer();
    const composer = renderer.root.findByProps({ testID: 'composer' });

    act(() => composer.props.onPlusPress());
    act(() => renderer.root.findByProps({ accessibilityLabel: 'Câmera' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'camera-preview' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'camera-controls' })).toBeTruthy();

    act(() => renderer.root.findByProps({ testID: 'composer' }).props.onPlusPress());
    setPanelState({ closing: false, mode: 'closed', sheet: 'camera' });
    act(() => renderer.root.findByProps({ testID: 'composer' }).props.onPlusPress());
    act(() => renderer.root.findByProps({ accessibilityLabel: 'Fotos' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'photo-grid' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'photo-controls' })).toBeTruthy();
  });
});

describe('Home Search local date formatting', () => {
  it('keeps the selected local calendar day and formats it in pt-BR without UTC conversion', () => {
    const localDate = new Date(2026, 8, 22, 0, 15);

    expect(localDateKey(localDate)).toBe('2026-09-22');
    expect(formatLocalDateAttachment('2026-09-22')).toBe('22 set 2026');
  });

  it.each([
    ['2026-09-03', '03/09'],
    ['2026-09-23', '23/09'],
    ['2026-12-01', '01/12'],
  ])('formats %s compactly as %s without UTC date conversion', (dateKey, expected) => {
    expect(formatLocalDateAttachmentCompact(dateKey)).toBe(expected);
  });
});
