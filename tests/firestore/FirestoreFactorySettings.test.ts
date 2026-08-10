import {
  factorySettingsFromFirestore,
  factorySettingsDocumentPath,
  factorySettingsToFirestore,
} from '@/services/factory/FirestoreFactorySettingsDataSource';

describe('Firestore factory settings', () => {
  it('uses one user-scoped document and preserves the textual bucket cost', () => {
    const settings = { bucketCost: '35,50' };

    expect(factorySettingsToFirestore(settings)).toEqual(settings);
    expect(factorySettingsFromFirestore({ bucketCost: '35,50' })).toEqual(settings);
    expect(factorySettingsDocumentPath('user-1')).toEqual([
      'users',
      'user-1',
      'settings',
      'factory',
    ]);
  });
});
