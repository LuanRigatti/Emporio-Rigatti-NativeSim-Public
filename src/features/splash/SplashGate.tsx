import { useEffect, useRef, useState } from 'react';

import SplashVisual, { type SplashPhase } from './components/SplashVisual';

const DISPLAY_DURATION_MS = 900;
const EXIT_DURATION_MS = 300;

export type AuthenticationCheck = () => Promise<boolean>;

export type SplashGateProps = {
  onComplete: (isLogged: boolean) => void;
  checkSession: AuthenticationCheck;
};

export function SplashGate({ checkSession, onComplete }: SplashGateProps) {
  const [phase, setPhase] = useState<SplashPhase>('entering');
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const entranceFrame = requestAnimationFrame(() => {
      if (isMounted) {
        setPhase('visible');
      }
    });

    const displayTimer = setTimeout(() => {
      void checkSession().then((isLogged) => {
        if (!isMounted || hasCompletedRef.current) return;

        hasCompletedRef.current = true;

        setPhase('exiting');
        exitTimer = setTimeout(() => {
          if (isMounted) {
            onComplete(isLogged);
          }
        }, EXIT_DURATION_MS);
      });
    }, DISPLAY_DURATION_MS);

    return () => {
      isMounted = false;
      cancelAnimationFrame(entranceFrame);
      clearTimeout(displayTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [checkSession, onComplete]);

  return <SplashVisual phase={phase} />;
}
