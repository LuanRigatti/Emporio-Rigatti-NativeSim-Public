export const DATA_NODES = {
  deliveries: 'entregas',
  dailyExpenses: 'gastosDiarios',
  monthlyExpenses: 'gastosMensais',
  factoryReceipts: 'recebimentoBaldes',
  customClients: 'clientesCustom',
  pushToken: 'pushToken',
} as const;

export function userNodePath(uid: string, node: string): string {
  if (uid.trim() === '') throw new Error('UID obrigatório.');
  return `usuarios/${uid}/${node}`;
}

export function userRootPath(uid: string): string {
  if (uid.trim() === '') throw new Error('UID obrigatÃ³rio.');
  return `usuarios/${uid}`;
}
