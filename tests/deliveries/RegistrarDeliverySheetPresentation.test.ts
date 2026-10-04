/* eslint-disable @typescript-eslint/no-require-imports */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { createElement } from 'react';

import {
  APPROVED_DARK_SHEET_GLASS_TINT,
  APPROVED_LIGHT_SHEET_GLASS_TINT,
} from '@/theme/sheetGlassTints';
import { RegistrarDeliverySheet } from '@/features/deliveries/components/RegistrarDeliverySheet';
import type { RegistrarDeliverySheetController } from '@/features/deliveries/hooks/useRegistrarDeliverySheet';

let mockResolvedMode: 'light' | 'dark' = 'light';
const nativeBottomSheetSource = readFileSync(
  resolve(
    process.cwd(),
    'src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx',
  ),
  'utf8',
);

jest.mock('@/components/native', () => {
  const React = require('react') as typeof import('react');

  return {
    NativeBottomSheet: (props: Record<string, unknown>) =>
      React.createElement('native-bottom-sheet', props),
  };
});

jest.mock('@/features/deliveries/hooks/useRegistrarDeliverySheet', () => ({
  DEFAULT_REGISTRAR_DELIVERY_BUCKET_PRICE: 49.8,
}));

jest.mock('@/theme', () => ({
  useAppTheme: () => ({ resolvedMode: mockResolvedMode }),
}));

function findSheet(instance: ReactTestInstance) {
  return instance.findAll((node) => String(node.type) === 'native-bottom-sheet')[0]!;
}

describe('RegistrarDeliverySheet presentation', () => {
  const controller = {
    clientItems: [],
    dismissSheet: jest.fn(),
    getSheetPhase: jest.fn(),
    handleConfirm: jest.fn(),
    handleDismiss: jest.fn(),
    handlePageSettled: jest.fn(),
    handleSelect: jest.fn(),
    handleVisibleChange: jest.fn(),
    openSheet: jest.fn(),
    recentlyAddedDeliveryIds: [],
    selectedClient: null,
    sheetDismissing: false,
    sheetVisible: true,
  } as unknown as RegistrarDeliverySheetController;

  beforeEach(() => {
    mockResolvedMode = 'light';
  });

  function renderSheet() {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        createElement(RegistrarDeliverySheet, {
          controller,
          initialPage: 0,
          useClientPager: true,
        }),
      );
    });

    return renderer;
  }

  it('preserves the Light Mode tint and modal dimming', () => {
    const renderer = renderSheet();
    const sheet = findSheet(renderer.root);

    expect(sheet.props.presentationBackgroundColor).toBeUndefined();
    expect(sheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(sheet.props.presentationBackgroundMode).toBe('native');
    expect(sheet.props.glassSurface).toBe(true);
    expect(APPROVED_LIGHT_SHEET_GLASS_TINT).toBe('rgba(242, 244, 245, 0.85)');
    expect(sheet.props.glassTint).toBe(APPROVED_LIGHT_SHEET_GLASS_TINT);
    expect(sheet.props.detents).toBeUndefined();
    expect(sheet.props.useClientPager).toBe(true);
    expect(sheet.props.initialPage).toBe(0);
    expect(sheet.props.title).toBe('Adicionar entrega');
    expect(sheet.props.subtitle).toBe('Escolha o cliente');
    expect(sheet.props.items).toBe(controller.clientItems);
    expect(sheet.props.selectedItem).toBe(controller.selectedClient);
    expect(sheet.props.onConfirm).toBe(controller.handleConfirm);
    expect(sheet.props.onDismiss).toBe(controller.handleDismiss);
    expect(sheet.props.onSelect).toBe(controller.handleSelect);
    expect(sheet.props.onVisibleChange).toBe(controller.handleVisibleChange);
    expect(sheet.props.visible).toBe(true);
  });

  it('uses the approved Dark Mode tint without changing native Glass or dimming', () => {
    mockResolvedMode = 'dark';
    const renderer = renderSheet();

    const sheet = findSheet(renderer.root);

    expect(sheet.props.presentationBackgroundColor).toBeUndefined();
    expect(sheet.props.presentationBackgroundInteraction).toBe('disabled');
    expect(sheet.props.presentationBackgroundMode).toBe('native');
    expect(sheet.props.glassSurface).toBe(true);
    expect(APPROVED_DARK_SHEET_GLASS_TINT).toBe('rgba(28, 28, 30, 0.82)');
    expect(sheet.props.glassTint).toBe(APPROVED_DARK_SHEET_GLASS_TINT);
  });

  it('keeps the native Glass shell, delivery pager, date, confirmation, and drag detents', () => {
    expect(nativeBottomSheetSource).toContain('interactive: true');
    expect(nativeBottomSheetSource).toContain("variant: 'regular'");
    expect(nativeBottomSheetSource).toContain('RegistrarDeliveryPagerRN');
    expect(nativeBottomSheetSource).toContain('<DatePicker');
    expect(nativeBottomSheetSource).toContain('Confirmar');
    expect(nativeBottomSheetSource).toContain('REGISTRAR_LIST_COMPACT_DETENT');
    expect(nativeBottomSheetSource).toContain('REGISTRAR_LIST_EXPANDED_DETENT');
    expect(nativeBottomSheetSource).toContain('REGISTRAR_DETAIL_DETENT');
    expect(nativeBottomSheetSource).toContain("presentationDragIndicator('visible')");
  });
});
