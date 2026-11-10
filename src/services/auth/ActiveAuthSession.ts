export type ActiveAuthSession = {
  uid: string | null;
  sessionVersion: number;
};

let activeAuthSession: ActiveAuthSession = { uid: null, sessionVersion: 0 };

export function setActiveAuthSession(uid: string | null, sessionVersion: number): void {
  activeAuthSession = { uid, sessionVersion };
}

export function isActiveAuthSession(uid: string | null, sessionVersion: number): boolean {
  return activeAuthSession.uid === uid && activeAuthSession.sessionVersion === sessionVersion;
}
