import { requireOptionalNativeModule } from 'expo';

export type ToolbarMorphDiagnosticRole = 'home-search' | 'settings-profile';
export type ToolbarMorphAccessoryLifecycleEvent = 'accessory_mount' | 'accessory_unmount';
export type ToolbarMorphNavigationLifecycleEvent = 'splash_replace_requested';
export type ToolbarMorphNavigationDestination = 'home' | 'login';

type ToolbarMorphDiagnosticsModule = {
  diagnosticsEnabled: boolean;
  recordAccessoryLifecycle(
    role: ToolbarMorphDiagnosticRole,
    event: ToolbarMorphAccessoryLifecycleEvent,
    instance: number,
  ): void;
  recordNavigationLifecycle(
    event: ToolbarMorphNavigationLifecycleEvent,
    destination: ToolbarMorphNavigationDestination,
  ): void;
};

const toolbarMorphDiagnostics =
  requireOptionalNativeModule<ToolbarMorphDiagnosticsModule>('ToolbarMorphDiagnostics');

export function recordToolbarMorphAccessoryLifecycle(
  role: ToolbarMorphDiagnosticRole,
  event: ToolbarMorphAccessoryLifecycleEvent,
  instance: number,
): void {
  if (!isToolbarMorphDiagnosticsEnabled()) return;
  toolbarMorphDiagnostics?.recordAccessoryLifecycle(role, event, instance);
}

export function isToolbarMorphDiagnosticsEnabled(): boolean {
  return __DEV__ || toolbarMorphDiagnostics?.diagnosticsEnabled === true;
}

export function recordToolbarMorphNavigationLifecycle(
  event: ToolbarMorphNavigationLifecycleEvent,
  destination: ToolbarMorphNavigationDestination,
): void {
  if (!isToolbarMorphDiagnosticsEnabled()) return;
  toolbarMorphDiagnostics?.recordNavigationLifecycle(event, destination);
}
