import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { widgetsDirectory } from 'expo-widgets';

const splashBrandAssets = [
  {
    module: require('../../../../assets/branding/splash-light.png'),
    filename: 'resumo-financeiro-splash-light.png',
  },
  {
    module: require('../../../../assets/branding/splash-dark.png'),
    filename: 'resumo-financeiro-splash-dark.png',
  },
] as const;

let preparationPromise: Promise<void> | null = null;

function assetDestination(directory: string, filename: string): string {
  return `${directory.endsWith('/') ? directory : `${directory}/`}${filename}`;
}

async function copySplashBrandAsset(directory: string, sourceModule: number, filename: string) {
  const asset = await Asset.fromModule(sourceModule).downloadAsync();
  if (!asset.localUri) return;

  const destination = assetDestination(directory, filename);
  const existingFile = await FileSystem.getInfoAsync(destination, { md5: true });
  if (existingFile.exists && existingFile.md5 && existingFile.md5 === asset.hash) return;

  const temporaryDestination = `${destination}.tmp`;
  await FileSystem.deleteAsync(temporaryDestination, { idempotent: true });
  await FileSystem.copyAsync({ from: asset.localUri, to: temporaryDestination });
  await FileSystem.deleteAsync(destination, { idempotent: true });
  await FileSystem.moveAsync({ from: temporaryDestination, to: destination });
}

export function prepareResumoFinanceiroWidgetBranding(): Promise<void> {
  if (!widgetsDirectory) return Promise.resolve();
  if (preparationPromise) return preparationPromise;

  preparationPromise = Promise.all(
    splashBrandAssets.map(({ module, filename }) =>
      copySplashBrandAsset(widgetsDirectory, module, filename),
    ),
  )
    .then(() => undefined)
    .finally(() => {
      preparationPromise = null;
    });

  return preparationPromise;
}
