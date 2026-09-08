import {
  AssetField,
  MediaType,
  Query,
  usePermissions,
  type PermissionResponse,
} from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';

const PAGE_SIZE = 180;

export interface LibraryPhoto {
  /** A local PHAsset/content URI or a local file URI. */
  id: string;
  kind?: 'photo' | 'file';
  name?: string;
  mimeType?: string;
}

export type LibraryStatus = 'loading' | 'denied' | 'empty' | 'ready';

export interface PhotoLibrary {
  photos: LibraryPhoto[];
  status: LibraryStatus;
}

function isReadable(permission: PermissionResponse | null) {
  return !!permission && (permission.granted || permission.accessPrivileges === 'limited');
}

/** Loads the newest local photos used by the source attachment grid. */
export function usePhotoLibrary(): PhotoLibrary {
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['photo'] });
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');

  const load = useCallback(async () => {
    try {
      const assets = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(PAGE_SIZE)
        .exeForMetadata();

      setPhotos(assets.map((asset) => ({ id: asset.id, kind: 'photo' })));
      setStatus(assets.length ? 'ready' : 'empty');
    } catch {
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!permission) return;
    if (isReadable(permission)) {
      // Loading starts only after the native permission result is available.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    } else if (!permission.canAskAgain) {
      setStatus('denied');
    }
  }, [permission, load]);

  return { photos, status };
}
