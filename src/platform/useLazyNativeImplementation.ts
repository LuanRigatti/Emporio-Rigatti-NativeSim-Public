import { useEffect, useState } from 'react';

export function useLazyNativeImplementation<T>(
  enabled: boolean,
  loader: () => Promise<T>,
): T | null {
  const [implementation, setImplementation] = useState<T | null>(null);

  useEffect(() => {
    let mounted = true;

    if (enabled) {
      void loader().then(
        (loaded) => {
          if (mounted) {
            // A component is a function, so pass a functional updater that
            // returns the component instead of letting React execute it as one.
            setImplementation(() => loaded);
          }
        },
        () => {
          if (mounted) {
            setImplementation(null);
          }
        },
      );
    } else {
      setImplementation(null);
    }

    return () => {
      mounted = false;
    };
  }, [enabled, loader]);

  return implementation;
}
