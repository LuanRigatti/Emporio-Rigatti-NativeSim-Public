import { requireOptionalNativeModule } from 'expo';

export type ToolbarMorphDiagnosticRole = 'home-search' | 'settings-profile';
export type ToolbarMorphAccessoryLifecycleEvent = 'accessory_mount' | 'accessory_unmount';

type ToolbarMorphDiagnosticsModule = {
  recordAccessoryLifecycle(
    role: ToolbarMorphDiagnosticRole,
    event: ToolbarMorphAccessoryLifecycleEvent,
    instance: number,
  ): void;
};

const toolbarMorphDiagnostics =
  requireOptionalNativeModule<ToolbarMorphDiagnosticsModule>('ToolbarMorphDiagnostics');

export function recordToolbarMorphAccessoryLifecycle(
  role: ToolbarMorphDiagnosticRole,
  event: ToolbarMorphAccessoryLifecycleEvent,
  instance: number,
): void {
  toolbarMorphDiagnostics?.recordAccessoryLifecycle(role, event, instance);
}
