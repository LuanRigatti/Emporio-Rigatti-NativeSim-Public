import type { ReactNode } from 'react';
import { createElement } from 'react';
import { Text, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { hasQuickLoginCredentials } from '@/config/quickLoginConfig';
import { LoginScreen } from '@/features/login/components/LoginScreen';

const mockSignInWithQuickLogin = jest.fn<Promise<void>, []>();
const mockSignInWithGoogleNative = jest.fn<Promise<void>, []>();
const mockTheme = {
  colors: {
    background: '#fff',
    danger: '#b42318',
    glassBorder: '#ddd',
    textPrimary: '#111',
    textSecondary: '#555',
  },
  opacities: { disabled: 0.5 },
  radius: { pill: 999 },
  sizes: { touchTargetMinimum: 44 },
  spacing: { lg: 16 },
  typography: { headline: {} },
};

jest.mock('@/providers', () => ({
  useSession: () => ({
    signInWithQuickLogin: mockSignInWithQuickLogin,
    signInWithGoogleNative: mockSignInWithGoogleNative,
  }),
}));

jest.mock('@/config/quickLoginConfig', () => ({
  hasQuickLoginCredentials: jest.fn(),
}));

const hasQuickLoginCredentialsMock = jest.mocked(hasQuickLoginCredentials);

jest.mock('@/components/premium', () => ({
  GlassSurface: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('@/components/branding/AppLogo', () => ({ AppLogo: () => null }));
jest.mock('@/features/login/components/GoogleMark', () => ({ GoogleMark: () => null }));
jest.mock('@/theme', () => ({ useAppTheme: () => ({ theme: mockTheme }) }));
jest.mock('@/utils/haptics', () => ({ triggerLightImpactHaptic: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSignInWithQuickLogin.mockReset();
    mockSignInWithGoogleNative.mockReset();
    hasQuickLoginCredentialsMock.mockReset();
    hasQuickLoginCredentialsMock.mockReturnValue(true);
  });

  function renderScreen(onAuthenticated = jest.fn()) {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        createElement(LoginScreen, {
          onAuthenticated,
        }),
      );
    });
    return { onAuthenticated, renderer: renderer! };
  }

  it('keeps Google first and adds the quick-entry button below it', () => {
    const { renderer } = renderScreen();
    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);

    expect(labels.indexOf('Login com Google')).toBeLessThan(labels.indexOf('Entrada rápida'));
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('keeps Google visible and hides quick entry when credentials are missing', () => {
    hasQuickLoginCredentialsMock.mockReturnValue(false);
    const { renderer } = renderScreen();

    expect(() => renderer.root.findByProps({ testID: 'login-google-button' })).not.toThrow();
    expect(renderer.root.findAllByProps({ testID: 'login-quick-entry-button' })).toHaveLength(0);
  });

  it('calls Google auth and shows loading only on the Google button', async () => {
    let finishGoogle: (() => void) | undefined;
    mockSignInWithGoogleNative.mockImplementation(
      () => new Promise<void>((resolve) => (finishGoogle = resolve)),
    );
    const { onAuthenticated, renderer } = renderScreen();
    const googleButton = renderer.root.findByProps({ testID: 'login-google-button' });
    let pendingLogin: void | Promise<void>;

    act(() => {
      pendingLogin = googleButton.props.onPress();
    });

    const quickLoginButton = renderer.root.findByProps({ testID: 'login-quick-entry-button' });
    expect(googleButton.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(quickLoginButton.props.accessibilityState).toEqual({ busy: false, disabled: true });
    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels.filter((label) => label === 'Entrando...')).toHaveLength(1);
    expect(quickLoginButton.props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      finishGoogle?.();
      await pendingLogin;
    });

    expect(mockSignInWithGoogleNative).toHaveBeenCalledTimes(1);
    expect(mockSignInWithQuickLogin).not.toHaveBeenCalled();
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('uses fixed-account quick login and shows loading only on its button', async () => {
    let finishQuickLogin: (() => void) | undefined;
    mockSignInWithQuickLogin.mockImplementation(
      () => new Promise<void>((resolve) => (finishQuickLogin = resolve)),
    );
    const { onAuthenticated, renderer } = renderScreen();
    const quickLoginButton = renderer.root.findByProps({ testID: 'login-quick-entry-button' });
    let pendingLogin: void | Promise<void>;

    act(() => {
      pendingLogin = quickLoginButton.props.onPress();
    });

    const googleButton = renderer.root.findByProps({ testID: 'login-google-button' });
    expect(quickLoginButton.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(googleButton.props.accessibilityState).toEqual({ busy: false, disabled: true });
    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(labels.filter((label) => label === 'Entrando...')).toHaveLength(1);
    expect(googleButton.props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      finishQuickLogin?.();
      await pendingLogin;
    });

    expect(mockSignInWithQuickLogin).toHaveBeenCalledTimes(1);
    expect(mockSignInWithGoogleNative).not.toHaveBeenCalled();
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('shows Firebase guidance when the fixed test account is not configured', async () => {
    mockSignInWithQuickLogin.mockRejectedValue(
      new Error('Defina EXPO_PUBLIC_QUICK_LOGIN_EMAIL e EXPO_PUBLIC_QUICK_LOGIN_PASSWORD.'),
    );
    const { renderer } = renderScreen();
    const quickLoginButton = renderer.root.findByProps({ testID: 'login-quick-entry-button' });

    await act(async () => {
      await quickLoginButton.props.onPress();
    });

    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toContain(
      'Defina EXPO_PUBLIC_QUICK_LOGIN_EMAIL e EXPO_PUBLIC_QUICK_LOGIN_PASSWORD.',
    );
  });
});
