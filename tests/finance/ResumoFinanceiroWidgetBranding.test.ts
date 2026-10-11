import { prepareResumoFinanceiroWidgetBranding } from '@/features/finance/widgets/ResumoFinanceiroWidgetBranding';

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn((source: unknown) => ({
      downloadAsync: jest.fn().mockResolvedValue({
        hash: `asset-hash-${String(source)}`,
        localUri: `file:///bundled/${String(source)}.png`,
      }),
    })),
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false, isDirectory: false }),
  moveAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-widgets', () => ({
  widgetsDirectory: 'file:///shared/ExpoWidgets',
}));

describe('ResumoFinanceiro widget branding assets', () => {
  it('copies both canonical splash variants into the shared widget directory', async () => {
    const fileSystem = jest.requireMock('expo-file-system/legacy') as {
      copyAsync: jest.Mock;
      moveAsync: jest.Mock;
    };

    await prepareResumoFinanceiroWidgetBranding();

    const copyDestinations = fileSystem.copyAsync.mock.calls
      .map(([options]) => (options as { to: string }).to)
      .sort();
    expect(copyDestinations).toEqual([
      'file:///shared/ExpoWidgets/resumo-financeiro-splash-dark.png.tmp',
      'file:///shared/ExpoWidgets/resumo-financeiro-splash-light.png.tmp',
    ]);

    const publishedDestinations = fileSystem.moveAsync.mock.calls
      .map(([options]) => (options as { to: string }).to)
      .sort();
    expect(publishedDestinations).toEqual([
      'file:///shared/ExpoWidgets/resumo-financeiro-splash-dark.png',
      'file:///shared/ExpoWidgets/resumo-financeiro-splash-light.png',
    ]);
  });
});
