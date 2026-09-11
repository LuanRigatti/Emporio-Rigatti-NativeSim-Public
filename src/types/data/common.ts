export type UnknownRecord = Record<string, unknown>;

export type DataMap<T> = Record<string, T>;

export type DataNodeName =
  | 'entregas'
  | 'gastosDiarios'
  | 'gastosMensais'
  | 'recebimentoBaldes'
  | 'clientesCustom'
  | 'pushToken';
