import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ENABLE_BIOMETRIC_UNLOCK } from '@/config/featureFlags';
import { biometricService } from '@/services/biometrics';
import { useBiometricUnlockPreference } from './useBiometricUnlockPreference';

type BiometricUnlockStatus = 'checking' | 'unlocked' | 'locked' | 'unavailable';

type UseBiometricUnlockOptions = {
  activeSession: boolean;
  authenticateOnMount?: boolean;
  relockOnBackground?: boolean;
  sessionKey?: string | null;
};

type BiometricUnlockResult = {
  canRetry: boolean;
  error: string | null;
  isLocked: boolean;
  isPrivacyActive: boolean;
  isReady: boolean;
  retry: () => Promise<void>;
  status: BiometricUnlockStatus;
};

type UnlockState = {
  key: string | null;
  status: BiometricUnlockStatus;
};

export function useBiometricUnlock({
  activeSession,
  authenticateOnMount = false,
  relockOnBackground = false,
  sessionKey: requestedSessionKey,
}: UseBiometricUnlockOptions): BiometricUnlockResult {
  const biometricPreference = useBiometricUnlockPreference();
  const preferenceReady = !ENABLE_BIOMETRIC_UNLOCK || biometricPreference.isHydrated;
  const biometricEnabled =
    ENABLE_BIOMETRIC_UNLOCK && preferenceReady && biometricPreference.enabled;
  const sessionKey = activeSession ? (requestedSessionKey ?? 'active-session') : null;
  const [unlockState, setUnlockState] = useState<UnlockState>(() => ({
    key: sessionKey,
    status:
      ENABLE_BIOMETRIC_UNLOCK && activeSession && authenticateOnMount ? 'checking' : 'unlocked',
  }));
  const [error, setError] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const activeSessionRef = useRef(activeSession);
  const sessionKeyRef = useRef(sessionKey);
  const biometricEnabledRef = useRef(biometricEnabled);
  const authenticationInFlightRef = useRef(false);
  const requiresUnlockRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (
      !ENABLE_BIOMETRIC_UNLOCK ||
      !biometricEnabledRef.current ||
      !activeSessionRef.current ||
      authenticationInFlightRef.current
    ) {
      return;
    }

    authenticationInFlightRef.current = true;
    setIsAuthenticating(true);
    const authenticationKey = sessionKeyRef.current;
    setUnlockState({ key: authenticationKey, status: 'checking' });
    setError(null);

    try {
      const support = await biometricService.getSupport();

      if (!support.hasHardware || !support.isEnrolled || !support.supportsFaceId) {
        requiresUnlockRef.current = false;
        setUnlockState({ key: authenticationKey, status: 'unavailable' });
        return;
      }

      const result = await biometricService.authenticate();

      if (result.success) {
        requiresUnlockRef.current = false;
        setUnlockState({ key: authenticationKey, status: 'unlocked' });
        return;
      }

      requiresUnlockRef.current = true;
      setUnlockState({ key: authenticationKey, status: 'locked' });
      setError(result.error ?? 'authentication_failed');
    } catch {
      requiresUnlockRef.current = true;
      setUnlockState({ key: authenticationKey, status: 'locked' });
      setError('authentication_failed');
    } finally {
      authenticationInFlightRef.current = false;
      setIsAuthenticating(false);
    }
  }, []);

  const retry = useCallback(() => authenticate(), [authenticate]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    sessionKeyRef.current = sessionKey;
    biometricEnabledRef.current = biometricEnabled;

    if (!activeSession || !biometricEnabled) {
      requiresUnlockRef.current = false;
      return;
    }

    if (authenticateOnMount) {
      // Start the external biometric operation after the effect commits.
      void Promise.resolve().then(() => authenticate());
    }
  }, [activeSession, authenticate, authenticateOnMount, biometricEnabled, sessionKey]);

  useEffect(() => {
    if (!ENABLE_BIOMETRIC_UNLOCK || !relockOnBackground) {
      return undefined;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (!activeSessionRef.current || !biometricEnabledRef.current) return;

      setAppState(nextState);

      if (nextState === 'background' || nextState === 'inactive') {
        // Face ID itself can briefly produce an inactive/active transition.
        // Never relock while the native prompt owned by this hook is active.
        if (authenticationInFlightRef.current) return;

        requiresUnlockRef.current = true;
        setError(null);
        setUnlockState({ key: sessionKeyRef.current, status: 'locked' });
        return;
      }

      if (nextState === 'active' && requiresUnlockRef.current) {
        void authenticate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [authenticate, relockOnBackground]);

  const visibleStatus = !biometricEnabled
    ? 'unlocked'
    : unlockState.key === sessionKey
      ? unlockState.status
      : activeSession && authenticateOnMount
        ? 'checking'
        : 'unlocked';
  const isWaitingForPreference = ENABLE_BIOMETRIC_UNLOCK && activeSession && !preferenceReady;

  return {
    canRetry:
      biometricEnabled && visibleStatus === 'locked' && appState === 'active' && !isAuthenticating,
    error: biometricEnabled && unlockState.key === sessionKey && activeSession ? error : null,
    isLocked: biometricEnabled && visibleStatus === 'locked',
    isPrivacyActive:
      biometricEnabled && (visibleStatus === 'checking' || visibleStatus === 'locked'),
    isReady:
      !isWaitingForPreference && (visibleStatus === 'unlocked' || visibleStatus === 'unavailable'),
    retry,
    status: visibleStatus,
  };
}
