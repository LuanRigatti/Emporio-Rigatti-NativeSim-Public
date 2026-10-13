import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { prepareResumoFinanceiroWidgetBranding } from '@/features/finance/widgets/ResumoFinanceiroWidgetBranding';

const optimizedWidgetMarks = [
  'resumo-financeiro-mark-light.png',
  'resumo-financeiro-mark-dark.png',
] as const;

function readPngMetadata(fileName: string) {
  const assetPath = resolve(process.cwd(), 'assets/branding', fileName);
  const bytes = readFileSync(assetPath);

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
    size: statSync(assetPath).size,
  };
}

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

jest.mock('@/features/deliveries/widgets/EntregasDoDiaWidget', () => ({
  entregasDoDiaWidget: { reload: jest.fn() },
}));

jest.mock('@/features/finance/widgets/ResumoFinanceiroWidget', () => ({
  resumoFinanceiroWidget: { reload: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();

  const assets = jest.requireMock('expo-asset') as {
    Asset: { fromModule: jest.Mock };
  };
  assets.Asset.fromModule.mockImplementation((source: unknown) => ({
    downloadAsync: jest.fn().mockResolvedValue({
      hash: `asset-hash-${String(source)}`,
      localUri: `file:///bundled/${String(source)}.png`,
    }),
  }));

  const fileSystem = jest.requireMock('expo-file-system/legacy') as {
    copyAsync: jest.Mock;
    deleteAsync: jest.Mock;
    getInfoAsync: jest.Mock;
    moveAsync: jest.Mock;
  };
  fileSystem.copyAsync.mockResolvedValue(undefined);
  fileSystem.deleteAsync.mockResolvedValue(undefined);
  fileSystem.getInfoAsync.mockResolvedValue({ exists: false, isDirectory: false });
  fileSystem.moveAsync.mockResolvedValue(undefined);
});

describe('ResumoFinanceiro widget branding assets', () => {
  it('copies both optimized canonical splash marks into the shared widget directory', async () => {
    const fileSystem = jest.requireMock('expo-file-system/legacy') as {
      copyAsync: jest.Mock;
      moveAsync: jest.Mock;
    };

    await prepareResumoFinanceiroWidgetBranding();

    const copyDestinations = fileSystem.copyAsync.mock.calls
      .map(([options]) => (options as { to: string }).to)
      .sort();
    expect(copyDestinations).toEqual([
      'file:///shared/ExpoWidgets/resumo-financeiro-mark-dark.png.tmp',
      'file:///shared/ExpoWidgets/resumo-financeiro-mark-light.png.tmp',
    ]);

    const publishedDestinations = fileSystem.moveAsync.mock.calls
      .map(([options]) => (options as { to: string }).to)
      .sort();
    expect(publishedDestinations).toEqual([
      'file:///shared/ExpoWidgets/resumo-financeiro-mark-dark.png',
      'file:///shared/ExpoWidgets/resumo-financeiro-mark-light.png',
    ]);

    expect(
      (
        jest.requireMock('@/features/finance/widgets/ResumoFinanceiroWidget') as {
          resumoFinanceiroWidget: { reload: jest.Mock };
        }
      ).resumoFinanceiroWidget.reload,
    ).toHaveBeenCalledTimes(1);
    expect(
      (
        jest.requireMock('@/features/deliveries/widgets/EntregasDoDiaWidget') as {
          entregasDoDiaWidget: { reload: jest.Mock };
        }
      ).entregasDoDiaWidget.reload,
    ).toHaveBeenCalledTimes(1);
    const lastAssetMove = Math.max(...fileSystem.moveAsync.mock.invocationCallOrder);
    const financeReload = (
      jest.requireMock('@/features/finance/widgets/ResumoFinanceiroWidget') as {
        resumoFinanceiroWidget: { reload: jest.Mock };
      }
    ).resumoFinanceiroWidget.reload;
    const deliveryReload = (
      jest.requireMock('@/features/deliveries/widgets/EntregasDoDiaWidget') as {
        entregasDoDiaWidget: { reload: jest.Mock };
      }
    ).entregasDoDiaWidget.reload;
    expect(financeReload.mock.invocationCallOrder[0]).toBeGreaterThan(lastAssetMove);
    expect(deliveryReload.mock.invocationCallOrder[0]).toBeGreaterThan(lastAssetMove);
  });

  it('does not reload widget timelines when both shared assets already match the bundle', async () => {
    const assets = jest.requireMock('expo-asset') as {
      Asset: { fromModule: jest.Mock };
    };
    assets.Asset.fromModule.mockImplementation(() => ({
      downloadAsync: jest.fn().mockResolvedValue({
        hash: 'current-asset-hash',
        localUri: 'file:///bundled/current.png',
      }),
    }));

    const fileSystem = jest.requireMock('expo-file-system/legacy') as {
      copyAsync: jest.Mock;
      getInfoAsync: jest.Mock;
      moveAsync: jest.Mock;
    };
    fileSystem.getInfoAsync.mockResolvedValue({ exists: true, md5: 'current-asset-hash' });

    await prepareResumoFinanceiroWidgetBranding();

    expect(fileSystem.copyAsync).not.toHaveBeenCalled();
    expect(fileSystem.moveAsync).not.toHaveBeenCalled();
    expect(
      (
        jest.requireMock('@/features/finance/widgets/ResumoFinanceiroWidget') as {
          resumoFinanceiroWidget: { reload: jest.Mock };
        }
      ).resumoFinanceiroWidget.reload,
    ).not.toHaveBeenCalled();
    expect(
      (
        jest.requireMock('@/features/deliveries/widgets/EntregasDoDiaWidget') as {
          entregasDoDiaWidget: { reload: jest.Mock };
        }
      ).entregasDoDiaWidget.reload,
    ).not.toHaveBeenCalled();
  });

  it.each(optimizedWidgetMarks)(
    'keeps %s as a small 96×96 RGBA widget asset instead of the original splash canvas',
    (fileName) => {
      const metadata = readPngMetadata(fileName);

      expect(metadata).toEqual({
        width: 96,
        height: 96,
        colorType: 6,
        size: expect.any(Number),
      });
      expect(metadata.size).toBeLessThan(10_000);
    },
  );

  it('bundles the optimized marks and does not load the original splash canvases', () => {
    const brandingSource = readFileSync(
      resolve(process.cwd(), 'src/features/finance/widgets/ResumoFinanceiroWidgetBranding.ts'),
      'utf8',
    );

    for (const fileName of optimizedWidgetMarks) {
      expect(brandingSource).toContain(`assets/branding/${fileName}`);
    }
    expect(brandingSource).not.toContain('assets/branding/splash-light.png');
    expect(brandingSource).not.toContain('assets/branding/splash-dark.png');
  });
});
