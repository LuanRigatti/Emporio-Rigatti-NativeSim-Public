export type DataErrorCode =
  | 'configuration'
  | 'authentication'
  | 'permission'
  | 'network'
  | 'timeout'
  | 'validation'
  | 'user-data-not-found'
  | 'serialization'
  | 'conflict'
  | 'unknown';

export class DataError extends Error {
  public readonly code: DataErrorCode;
  public readonly causeValue: unknown;

  public constructor(code: DataErrorCode, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export function toDataError(error: unknown, fallbackMessage: string): DataError {
  if (error instanceof DataError) return error;
  if (error instanceof Error) {
    return new DataError('unknown', error.message, error);
  }
  return new DataError('unknown', fallbackMessage, error);
}
