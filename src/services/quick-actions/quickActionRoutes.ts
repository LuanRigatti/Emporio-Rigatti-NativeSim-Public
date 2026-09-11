export const QUICK_ACTION_TYPES = {
  history: 'com.pareact.quick-action.history',
  registerData: 'com.pareact.quick-action.register-data',
  registerDelivery: 'com.pareact.quick-action.register-delivery',
  testMode: 'com.pareact.quick-action.test-mode',
} as const;

export type QuickActionType = (typeof QUICK_ACTION_TYPES)[keyof typeof QUICK_ACTION_TYPES];

export const QUICK_ACTION_ROUTES: Record<QuickActionType, string> = {
  [QUICK_ACTION_TYPES.history]: '/historico',
  [QUICK_ACTION_TYPES.registerData]: '/registrar/dados',
  [QUICK_ACTION_TYPES.registerDelivery]: '/registrar/entrega',
  [QUICK_ACTION_TYPES.testMode]: '/configuracoes/modo-teste',
};

export function getQuickActionRoute(type: string): string | null {
  return Object.prototype.hasOwnProperty.call(QUICK_ACTION_ROUTES, type)
    ? QUICK_ACTION_ROUTES[type as QuickActionType]
    : null;
}
