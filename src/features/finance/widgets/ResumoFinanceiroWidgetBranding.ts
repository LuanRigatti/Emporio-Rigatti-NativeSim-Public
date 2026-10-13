import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { widgetsDirectory } from 'expo-widgets';
import { entregasDoDiaWidget } from '@/features/deliveries/widgets/EntregasDoDiaWidget';

import { resumoFinanceiroWidget } from './ResumoFinanceiroWidget';

const widgetBrandAssets = [
  {
    module: require('../../../../assets/branding/resumo-financeiro-mark-light.png'),
    filename: 'resumo-financeiro-mark-light.png',
  },
  {
    module: require('../../../../assets/branding/resumo-financeiro-mark-dark.png'),
    filename: 'resumo-financeiro-mark-dark.png',
  },
] as const;

let preparationPromise: Promise<void> | null = null;

function assetDestination(directory: string, filename: string): string {
  return `${directory.endsWith('/') ? directory : `${directory}/`}${filename}`;
}

async function copyWidgetBrandAsset(
  directory: string,
  sourceModule: number,
  filename: string,
): Promise<boolean> {
  const asset = await Asset.fromModule(sourceModule).downloadAsync();
  if (!asset.localUri) return false;

  const destination = assetDestination(directory, filename);
  const existingFile = await FileSystem.getInfoAsync(destination, { md5: true });
  if (existingFile.exists && existingFile.md5 && existingFile.md5 === asset.hash) return false;

  const temporaryDestination = `${destination}.tmp`;
  await FileSystem.deleteAsync(temporaryDestination, { idempotent: true });
  await FileSystem.copyAsync({ from: asset.localUri, to: temporaryDestination });
  await FileSystem.deleteAsync(destination, { idempotent: true });
  await FileSystem.moveAsync({ from: temporaryDestination, to: destination });
  return true;
}

export function prepareResumoFinanceiroWidgetBranding(): Promise<void> {
  if (!widgetsDirectory) return Promise.resolve();
  if (preparationPromise) return preparationPromise;

  preparationPromise = Promise.all(
    widgetBrandAssets.map(({ module, filename }) =>
      copyWidgetBrandAsset(widgetsDirectory, module, filename),
    ),
  )
    .then((updatedAssets) => {
      if (updatedAssets.some(Boolean)) {
        // The extension can render an initial timeline before these shared files exist.
        // Re-evaluate both widget kinds only after their images are ready.
        resumoFinanceiroWidget.reload();
        entregasDoDiaWidget.reload();
      }
    })
    .finally(() => {
      preparationPromise = null;
    });

  return preparationPromise;
}
