import type { NativeStackNavigationProp } from 'expo-router';

type Navigation = NativeStackNavigationProp<Record<string, object | undefined>>;

export function getNavigationTopRoute(navigation: Navigation): string | undefined {
  try {
    const state = navigation.getState() as
      { index?: unknown; routes?: { name?: unknown }[] } | undefined;
    if (!state || !Array.isArray(state.routes)) return undefined;
    const index = typeof state.index === 'number' ? state.index : 0;
    const name = state.routes[index]?.name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}
