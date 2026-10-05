import { hasQuickLoginCredentials, resolveQuickLoginCredentials } from '@/config/quickLoginConfig';

describe('quick login configuration', () => {
  it('trims the fixed account email and preserves the password exactly', () => {
    expect(resolveQuickLoginCredentials(' quick-test@example.com ', '  password  ')).toEqual({
      email: 'quick-test@example.com',
      password: '  password  ',
    });
  });

  it.each([
    [undefined, 'password'],
    ['quick-test@example.com', undefined],
    ['   ', 'password'],
    ['quick-test@example.com', ''],
  ])('rejects incomplete test-account credentials (%s)', (email, password) => {
    expect(resolveQuickLoginCredentials(email, password)).toBeNull();
  });

  it.each([
    [undefined, 'password'],
    ['quick-test@example.com', undefined],
    ['   ', 'password'],
    ['quick-test@example.com', ''],
  ])('hides quick login when either credential is empty (%s)', (email, password) => {
    expect(hasQuickLoginCredentials(email, password)).toBe(false);
  });

  it('shows quick login only when both credentials are configured', () => {
    expect(hasQuickLoginCredentials('quick-test@example.com', 'password')).toBe(true);
  });
});
