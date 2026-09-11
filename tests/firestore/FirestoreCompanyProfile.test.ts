import {
  companyProfileDocumentPath,
  companyProfileFromFirestore,
  companyProfileToFirestore,
} from '@/services/company/FirestoreCompanyProfileDataSource';

describe('Firestore company profile', () => {
  it('uses one user-scoped settings document and preserves all profile fields', () => {
    const profile = {
      legalName: 'Empresa Legal',
      tradeName: 'Empório Rigatti',
      taxId: '00.000.000/0001-00',
      address: 'Rua Exemplo, 10',
    };

    expect(companyProfileToFirestore(profile)).toEqual(profile);
    expect(companyProfileFromFirestore(profile)).toEqual(profile);
    expect(companyProfileDocumentPath('user-1')).toEqual([
      'users',
      'user-1',
      'settings',
      'company',
    ]);
  });

  it('does not invent values for invalid remote fields', () => {
    expect(
      companyProfileFromFirestore({ legalName: 123, tradeName: null, taxId: {}, address: [] }),
    ).toEqual({ legalName: '', tradeName: '', taxId: '', address: '' });
  });
});
