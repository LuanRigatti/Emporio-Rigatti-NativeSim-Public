import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  authenticationTypes: LocalAuthentication.AuthenticationType[];
  enrolledLevel: LocalAuthentication.SecurityLevel;
  supportsFaceId: boolean;
};

const unsupportedBiometricSupport: BiometricSupport = {
  hasHardware: false,
  isEnrolled: false,
  authenticationTypes: [],
  enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
  supportsFaceId: false,
};

async function safelyRead<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

export class BiometricService {
  public authenticate() {
    return LocalAuthentication.authenticateAsync({
      cancelLabel: 'Cancelar',
      disableDeviceFallback: true,
      promptMessage: 'Desbloqueie o aplicativo com Face ID',
    });
  }

  public async getSupport(): Promise<BiometricSupport> {
    const [hasHardware, isEnrolled, authenticationTypes, enrolledLevel] = await Promise.all([
      safelyRead(() => LocalAuthentication.hasHardwareAsync(), false),
      safelyRead(() => LocalAuthentication.isEnrolledAsync(), false),
      safelyRead(() => LocalAuthentication.supportedAuthenticationTypesAsync(), []),
      safelyRead(
        () => LocalAuthentication.getEnrolledLevelAsync(),
        LocalAuthentication.SecurityLevel.NONE,
      ),
    ]);

    return {
      hasHardware,
      isEnrolled,
      authenticationTypes,
      enrolledLevel,
      supportsFaceId: authenticationTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ),
    };
  }

  public getUnavailableSupport(): BiometricSupport {
    return { ...unsupportedBiometricSupport };
  }
}

export const biometricService = new BiometricService();
