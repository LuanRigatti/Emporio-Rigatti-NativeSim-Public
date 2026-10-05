export type QuickLoginCredentials = {
  email: string;
  password: string;
};

export function resolveQuickLoginCredentials(
  emailValue: string | undefined,
  passwordValue: string | undefined,
): QuickLoginCredentials | null {
  const email = emailValue?.trim();
  if (!email || !passwordValue) return null;

  return { email, password: passwordValue };
}

export function getQuickLoginCredentials(): QuickLoginCredentials | null {
  return resolveQuickLoginCredentials(
    process.env.EXPO_PUBLIC_QUICK_LOGIN_EMAIL,
    process.env.EXPO_PUBLIC_QUICK_LOGIN_PASSWORD,
  );
}

export function hasQuickLoginCredentials(
  emailValue = process.env.EXPO_PUBLIC_QUICK_LOGIN_EMAIL,
  passwordValue = process.env.EXPO_PUBLIC_QUICK_LOGIN_PASSWORD,
): boolean {
  return resolveQuickLoginCredentials(emailValue, passwordValue) !== null;
}
