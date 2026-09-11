import { normalizeClientKey } from '@/utils/data';

export const KNOWN_CLIENT_ADDRESSES: Readonly<Record<string, string>> = {
  aldo: 'R. Portugal, 319 - São Francisco, Curitiba - PR, 80510-280',
  elias: 'Avenida Marechal Floriano Peixoto, 661 Centro Curitiba - PR, 80010-130',
  escola: 'Avenida Coronel Augusto de Almeida Garret, 135, Taruma, Curitiba - PR 82821-002',
  andre: 'R. Barão do Rio Branco, 41 - Centro, Curitiba - PR, 80010-180',
  lu: 'R. Alfredo Bufren, 226 - Centro, Curitiba - PR, 80020-240',
  helder: 'R. Alfredo Bufren, 209 - Centro, Curitiba - PR, 80020-240',
  luciano: 'Av. Sete de Setembro, 3664 - Centro, Curitiba - PR, 80250-210',
  sandro: 'R. Voluntários da Pátria, 251 - Centro, Curitiba - PR, 80020-000',
  viana: 'R. Saldanha Marinho, 68 - Centro, Curitiba - PR, 80410-150',
  marcia: 'R. Des. Benvindo Valente, 320 - São Francisco, Curitiba - PR, 80520-020',
  vaticano: 'R. Albino Silva, 54 - São Francisco, Curitiba - PR, 80520-210',
  gilson: 'R. José Loureiro, 274 - Centro, Curitiba - PR, 80010-000',
  guilherme: 'Av. Vicente Machado, 124 - Centro, Curitiba - PR, 80420-010',
};

export function getKnownClientAddress(clientName: string): string | undefined {
  return KNOWN_CLIENT_ADDRESSES[normalizeClientKey(clientName)];
}
