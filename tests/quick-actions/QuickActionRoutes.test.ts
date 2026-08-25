import {
  getQuickActionRoute,
  QUICK_ACTION_ROUTES,
  QUICK_ACTION_TYPES,
} from '@/services/quick-actions/quickActionRoutes';

describe('Home Screen Quick Action routes', () => {
  it('maps every static shortcut to its existing Expo Router route', () => {
    expect(QUICK_ACTION_ROUTES).toEqual({
      [QUICK_ACTION_TYPES.history]: '/historico',
      [QUICK_ACTION_TYPES.registerData]: '/registrar/dados',
      [QUICK_ACTION_TYPES.registerDelivery]: '/registrar/entrega',
      [QUICK_ACTION_TYPES.testMode]: '/configuracoes/modo-teste',
    });
  });

  it('ignores unknown native shortcut types', () => {
    expect(getQuickActionRoute('com.pareact.quick-action.unknown')).toBeNull();
  });
});
