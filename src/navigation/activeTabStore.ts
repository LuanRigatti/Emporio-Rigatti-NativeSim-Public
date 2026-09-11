import { useSyncExternalStore } from 'react';

export type TabName = 'dashboard' | 'financeiro' | 'registrar' | 'historico' | 'configuracoes';

type StoreState = {
  activeTab: TabName;
  homeProfileHandler: (() => void) | null;
  homeSearchHandler: (() => void) | null;
  financeToolbarRenderer: (() => React.ReactNode) | null;
};

let state: StoreState = {
  activeTab: 'dashboard',
  homeProfileHandler: null,
  homeSearchHandler: null,
  financeToolbarRenderer: null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const activeTabStore = {
  getState(): StoreState {
    return state;
  },
  getActiveTab(): TabName {
    return state.activeTab;
  },
  setActiveTab(tab: TabName) {
    if (state.activeTab === tab) return;
    state = { ...state, activeTab: tab };
    notify();
  },
  setHomeHandlers(handlers: { onProfilePress?: () => void; onSearchPress?: () => void }) {
    state = {
      ...state,
      homeProfileHandler: handlers.onProfilePress ?? null,
      homeSearchHandler: handlers.onSearchPress ?? null,
    };
    notify();
  },
  setFinanceToolbarRenderer(renderer: (() => React.ReactNode) | null) {
    state = { ...state, financeToolbarRenderer: renderer };
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useActiveTabStore<T>(selector: (state: StoreState) => T): T {
  return useSyncExternalStore(
    activeTabStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
