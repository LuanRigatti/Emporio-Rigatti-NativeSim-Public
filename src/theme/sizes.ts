export const sizes = {
  touchTargetMinimum: 44,
  iconSmall: 20,
  iconMedium: 24,
  iconLarge: 32,
  inputHeight: 48,
  buttonHeight: 48,
  tabBarHeight: 64,
  avatarSmall: 32,
  avatarMedium: 40,
  avatarLarge: 56,
} as const;

export type Sizes = typeof sizes;
