const { withInfoPlist } = require('expo/config-plugins');

const QUICK_ACTIONS = [
  {
    UIApplicationShortcutItemIconType: 'UIApplicationShortcutIconTypeCompose',
    UIApplicationShortcutItemTitle: 'Registrar entrega',
    UIApplicationShortcutItemType: 'com.pareact.quick-action.register-delivery',
  },
  {
    UIApplicationShortcutItemIconType: 'UIApplicationShortcutIconTypeCompose',
    UIApplicationShortcutItemTitle: 'Registrar dados',
    UIApplicationShortcutItemType: 'com.pareact.quick-action.register-data',
  },
  {
    UIApplicationShortcutItemIconType: 'UIApplicationShortcutIconTypeSettings',
    UIApplicationShortcutItemTitle: 'Modo Teste',
    UIApplicationShortcutItemType: 'com.pareact.quick-action.test-mode',
  },
  {
    UIApplicationShortcutItemIconType: 'UIApplicationShortcutIconTypeTime',
    UIApplicationShortcutItemTitle: 'Histórico',
    UIApplicationShortcutItemType: 'com.pareact.quick-action.history',
  },
];

module.exports = function withHomeScreenQuickActions(config) {
  return withInfoPlist(config, (configWithInfoPlist) => {
    const existingItems = Array.isArray(configWithInfoPlist.modResults.UIApplicationShortcutItems)
      ? configWithInfoPlist.modResults.UIApplicationShortcutItems
      : [];
    const quickActionTypes = new Set(
      QUICK_ACTIONS.map((item) => item.UIApplicationShortcutItemType),
    );

    configWithInfoPlist.modResults.UIApplicationShortcutItems = [
      ...QUICK_ACTIONS,
      ...existingItems.filter((item) => !quickActionTypes.has(item.UIApplicationShortcutItemType)),
    ];

    return configWithInfoPlist;
  });
};
