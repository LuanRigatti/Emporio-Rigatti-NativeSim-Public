export const DATA_NODES = {
  deliveries: 'entregas',
  dailyExpenses: 'gastosDiarios',
  monthlyExpenses: 'gastosMensais',
  factoryReceipts: 'recebimentoBaldes',
  customClients: 'clientesCustom',
  pushToken: 'pushToken',
} as const;

export function assertFirebaseUid(uid: string): void {
  if (uid.trim() === '') throw new Error('UID obrigatorio.');
  if (uid === 'mock-user-1') {
    throw new Error('UID mock nao pode acessar dados Firebase.');
  }
}

export function userNodePath(uid: string, node: string): string {
  assertFirebaseUid(uid);
  return `usuarios/${uid}/${node}`;
}

export function userRootPath(uid: string): string {
  assertFirebaseUid(uid);
  return `usuarios/${uid}`;
}
