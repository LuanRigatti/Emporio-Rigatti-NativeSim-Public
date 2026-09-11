import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthProvider';
import { notificationService, type NotificationSubscription } from '@/services/notifications';
import type { AppNotificationEvent, NotificationStatus } from '@/types';

export interface NotificationContextValue {
  status: NotificationStatus | null;
  lastEvent: AppNotificationEvent | null;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
  openSystemSettings: () => Promise<void>;
  clearError: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

type NotificationProviderProps = { children: ReactNode };

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [lastEvent, setLastEvent] = useState<AppNotificationEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStatus(await notificationService.getStatus(user.id));
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : 'Não foi possível consultar as notificações.',
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!user) throw new Error('Sessão não disponível.');
    setLoading(true);
    setError(null);
    try {
      setStatus(await notificationService.requestPermissionAndRegister(user.id));
    } catch (permissionError) {
      const message =
        permissionError instanceof Error
          ? permissionError.message
          : 'Não foi possível ativar as notificações.';
      setError(message);
      throw permissionError;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    notificationService.configure();
    const foregroundSubscription: NotificationSubscription =
      notificationService.subscribeToForeground(setLastEvent);
    return () => foregroundSubscription.remove();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (
      !user ||
      !status ||
      (status.permission !== 'granted' && status.permission !== 'provisional')
    ) {
      return undefined;
    }
    const subscription = notificationService.subscribeToTokenRenewal(user.id, (renewalError) => {
      setError(
        renewalError instanceof Error
          ? renewalError.message
          : 'Não foi possível atualizar o token de notificações.',
      );
    });
    return () => subscription.remove();
  }, [status, user]);

  const clearError = useCallback(() => setError(null), []);
  const openSystemSettings = useCallback(() => notificationService.openSystemSettings(), []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      clearError,
      error,
      lastEvent,
      loading,
      openSystemSettings,
      refresh,
      requestPermission,
      status,
    }),
    [clearError, error, lastEvent, loading, openSystemSettings, refresh, requestPermission, status],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications deve ser usado dentro de NotificationProvider.');
  return context;
}
