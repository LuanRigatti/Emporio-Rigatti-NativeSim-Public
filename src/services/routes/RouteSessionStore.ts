import type { RouteSession } from '@/types/route';

export class RouteSessionStore {
  private readonly sessions = new Map<string, RouteSession>();

  public save(session: RouteSession): void {
    this.sessions.set(session.id, session);
  }

  public get(sessionId: string): RouteSession | undefined {
    return this.sessions.get(sessionId);
  }

  public update(session: RouteSession): void {
    if (!this.sessions.has(session.id)) throw new Error('Sessão de rota não encontrada.');
    this.sessions.set(session.id, session);
  }

  public remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export const routeSessionStore = new RouteSessionStore();
