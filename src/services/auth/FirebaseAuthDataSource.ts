import { AuthService } from './AuthService';
import { signInWithNativeGoogle } from './NativeGoogleSignInService';

export class FirebaseAuthDataSource extends AuthService {
  public async signInWithGoogleNative() {
    const { accessToken, idToken } = await signInWithNativeGoogle();
    return this.signInWithGoogleCredential(idToken, accessToken);
  }
}

export const firebaseAuthDataSource = new FirebaseAuthDataSource();
