import {
  carSettingsDocumentPath,
  carSettingsFromFirestore,
  carSettingsToFirestore,
} from '@/services/car/FirestoreCarSettingsDataSource';

describe('Firestore car settings', () => {
  it('uses one user-scoped settings document and preserves both autonomy values', () => {
    const settings = {
      gasolineAutonomy: '7,4 Km/l',
      alcoholAutonomy: '5,6 Km/l',
    };

    expect(carSettingsToFirestore(settings)).toEqual(settings);
    expect(carSettingsFromFirestore(settings)).toEqual(settings);
    expect(carSettingsDocumentPath('user-1')).toEqual(['users', 'user-1', 'settings', 'car']);
  });

  it('does not invent values when a remote field has an invalid type', () => {
    expect(carSettingsFromFirestore({ gasolineAutonomy: 7.4, alcoholAutonomy: null })).toEqual({
      gasolineAutonomy: '',
      alcoholAutonomy: '',
    });
  });
});
