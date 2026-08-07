import {
  ENABLE_FIREBASE_APP_DATA,
  ENABLE_FIREBASE_AUTH,
  ENABLE_MOCK_CLIENT_DATA,
} from '@/config/featureFlags';
import {
  canEnableFirebaseAppData,
  getFirebaseReadiness,
} from '@/services/data/FirebaseReadinessGate';

describe('Firebase readiness gate', () => {
  it('reports the current architecture as ready without enabling Firebase', () => {
    const report = getFirebaseReadiness();

    expect(report.status).toBe('READY');
    expect(report.canEnable).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.domains.find((domain) => domain.domain === 'location')?.status).toBe(
      'LOCAL_ONLY',
    );
    expect(report.domains.find((domain) => domain.domain === 'stock')?.status).toBe('DERIVED');
    expect(report.domains.find((domain) => domain.domain === 'deliveries')?.status).toBe('READY');
    expect(canEnableFirebaseAppData()).toBe(true);
  });

  it('blocks readiness when a required adapter is unavailable', () => {
    const report = getFirebaseReadiness({ factoryAdapter: null });

    expect(report.status).toBe('BLOCKED');
    expect(report.canEnable).toBe(false);
    expect(report.blockers).toContain('factory: adapter or mapper unavailable');
    expect(report.domains.find((domain) => domain.domain === 'factory')?.status).toBe('BLOCKED');
  });

  it('keeps all Firebase activation flags unchanged and disabled', () => {
    expect(ENABLE_FIREBASE_APP_DATA).toBe(false);
    expect(ENABLE_FIREBASE_AUTH).toBe(false);
    expect(ENABLE_MOCK_CLIENT_DATA).toBe(true);

    expect(getFirebaseReadiness().flags).toEqual({
      enableFirebaseAppData: false,
      enableFirebaseAuth: false,
      enableMockClientData: true,
    });
  });

  it('blocks readiness if the local-only policy is not supplied', () => {
    const report = getFirebaseReadiness({ localOnlyPolicy: false });

    expect(report.status).toBe('BLOCKED');
    expect(report.blockers).toContain('local-only data policy is not formalized');
  });
});
