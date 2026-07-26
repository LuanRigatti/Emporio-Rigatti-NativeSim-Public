import { useEffect, useState } from 'react';

export function useLazyNativeImplementation<T>(
  enabled: boolean,
  loader: () => Promise<T>,
): T | null {
  const [implementation, setImplementation] = useState<T | null>(null);

  useEffect(() => {
    let mounted = true;

    if (enabled) {
      void loader().then((loaded) => {
        if (mounted) {
          setImplementation(loaded);
        }
      });
    } else {
      setImplementation(null);
    }

    return () => {
      mounted = false;
    };
  }, [enabled, loader]);

  return implementation;
}
