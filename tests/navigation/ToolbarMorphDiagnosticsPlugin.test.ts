import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const screensRoot = path.resolve('node_modules/react-native-screens');
const expoUIRoot = path.resolve('node_modules/@expo/ui');
const requireFromTest = createRequire(__filename);
const appConfigPath = path.resolve('app.config.js');
const appConfigRequire = createRequire(__filename);

function resolveExperimentVariant(configuredVariant?: string) {
  const previousVariant = process.env.TOOLBAR_MORPH_EXPERIMENT_VARIANT;
  if (configuredVariant === undefined) {
    delete process.env.TOOLBAR_MORPH_EXPERIMENT_VARIANT;
  } else {
    process.env.TOOLBAR_MORPH_EXPERIMENT_VARIANT = configuredVariant;
  }

  let config: { ios?: { infoPlist?: Record<string, unknown> } } | undefined;
  try {
    jest.isolateModules(() => {
      config = appConfigRequire(appConfigPath).expo as {
        ios?: { infoPlist?: Record<string, unknown> };
      };
    });
  } finally {
    if (previousVariant === undefined) {
      delete process.env.TOOLBAR_MORPH_EXPERIMENT_VARIANT;
    } else {
      process.env.TOOLBAR_MORPH_EXPERIMENT_VARIANT = previousVariant;
    }
  }

  if (!config) throw new Error('Could not resolve app.config.js for toolbar morph experiment.');
  return config.ios?.infoPlist?.EmporioToolbarMorphExperimentVariant;
}

const diagnosticsEnvironmentKeys = [
  'APP_VARIANT',
  'BUILD_CONFIGURATION',
  'GITHUB_ACTIONS',
  'GITHUB_EVENT_NAME',
  'GITHUB_REF',
  'GITHUB_REPOSITORY',
  'GITHUB_WORKFLOW_REF',
  'TOOLBAR_MORPH_DIAGNOSTICS',
] as const;

const nativeSimReleaseDiagnosticsEnvironment = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/sdk58-codex',
  GITHUB_REPOSITORY: 'LuanRigatti/Emporio-Rigatti-NativeSim-Public',
  GITHUB_WORKFLOW_REF:
    'LuanRigatti/Emporio-Rigatti-NativeSim-Public/.github/workflows/native-sim.yml@refs/heads/sdk58-codex',
  BUILD_CONFIGURATION: 'release',
};

function resolveDiagnosticsEnabled(environment: Record<string, string> = {}) {
  const previousEnvironment = new Map(
    diagnosticsEnvironmentKeys.map((key) => [key, process.env[key]]),
  );

  let config: { ios?: { infoPlist?: Record<string, unknown> } } | undefined;
  try {
    for (const key of diagnosticsEnvironmentKeys) {
      const value = environment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    delete appConfigRequire.cache[appConfigPath];
    jest.isolateModules(() => {
      config = appConfigRequire(appConfigPath).expo as {
        ios?: { infoPlist?: Record<string, unknown> };
      };
    });
  } finally {
    delete appConfigRequire.cache[appConfigPath];
    for (const [key, value] of previousEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  if (!config) throw new Error('Could not resolve app.config.js diagnostics flag.');
  return config.ios?.infoPlist?.EmporioToolbarMorphDiagnosticsEnabled;
}

const screensPatch = requireFromTest('../../plugins/withRNScreensHideBottomBarWhenPushed') as {
  __patchRNScreensForTests: (root: string) => void;
};
const toolbarMorphPatch = requireFromTest('../../plugins/withToolbarMorphDiagnostics') as {
  __patchToolbarMorphDiagnosticsForTests: (options: {
    screensRoot: string;
    expoUIRoot: string;
  }) => void;
};

const screensFiles = [
  'package.json',
  'src/fabric/ScreenNativeComponent.ts',
  'ios/RNSScreen.h',
  'ios/RNSScreen.mm',
  'ios/RNSScreenStack.mm',
  'ios/RNSScreenStackHeaderConfig.mm',
  'ios/RNSScreenStackHeaderSubview.h',
  'ios/RNSScreenStackHeaderSubview.mm',
  'ios/tabs/host/RNSTabBarController.h',
  'ios/tabs/host/RNSTabBarController.mm',
];
const expoUIFiles = ['package.json', 'ios/HostView.swift'];
const patchedScreensFiles = [...screensFiles, 'ios/RNSToolbarMorphDiagnostics.h'];

function copyFixtureFiles(sourceRoot: string, targetRoot: string, relativePaths: string[]) {
  for (const relativePath of relativePaths) {
    const targetPath = path.join(targetRoot, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(path.join(sourceRoot, relativePath), targetPath);
  }
}

function createFixture() {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'emporio-toolbar-morph-'));
  const fixtureScreensRoot = path.join(fixtureRoot, 'react-native-screens');
  const fixtureExpoUIRoot = path.join(fixtureRoot, 'expo-ui');
  copyFixtureFiles(screensRoot, fixtureScreensRoot, screensFiles);
  copyFixtureFiles(expoUIRoot, fixtureExpoUIRoot, expoUIFiles);
  return { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot };
}

function patchFixture(fixtureScreensRoot: string, fixtureExpoUIRoot: string) {
  screensPatch.__patchRNScreensForTests(fixtureScreensRoot);
  toolbarMorphPatch.__patchToolbarMorphDiagnosticsForTests({
    screensRoot: fixtureScreensRoot,
    expoUIRoot: fixtureExpoUIRoot,
  });
}

function snapshotFixture(fixtureScreensRoot: string, fixtureExpoUIRoot: string) {
  return {
    screens: Object.fromEntries(
      patchedScreensFiles.map((relativePath) => [
        relativePath,
        readFileSync(path.join(fixtureScreensRoot, relativePath), 'utf8'),
      ]),
    ),
    host: readFileSync(path.join(fixtureExpoUIRoot, 'ios/HostView.swift'), 'utf8'),
  };
}

describe('temporary toolbar morph diagnostics plugin', () => {
  it('targets the installed Expo UI and react-native-screens versions', () => {
    expect(JSON.parse(readFileSync(path.join(screensRoot, 'package.json'), 'utf8')).version).toBe(
      '4.30.0',
    );
    expect(JSON.parse(readFileSync(path.join(expoUIRoot, 'package.json'), 'utf8')).version).toBe(
      '58.0.19',
    );
  });

  it('registers the coordinator patch before diagnostics in dangerous-mod execution order', () => {
    const appConfig = readFileSync(path.resolve('app.config.js'), 'utf8');
    const diagnosticsIndex = appConfig.indexOf("'./plugins/withToolbarMorphDiagnostics'");
    const coordinatorIndex = appConfig.indexOf("'./plugins/withRNScreensHideBottomBarWhenPushed'");

    expect(diagnosticsIndex).toBeGreaterThanOrEqual(0);
    expect(coordinatorIndex).toBeGreaterThan(diagnosticsIndex);
  });

  it('selects control A by default and B only through the dedicated build environment value', () => {
    expect(resolveExperimentVariant()).toBe('A');
    expect(resolveExperimentVariant('B')).toBe('B');
    expect(resolveExperimentVariant('unexpected')).toBe('A');
  });

  it('enables native diagnostics only for the SDK 58 NativeSim Release build context', () => {
    expect(resolveDiagnosticsEnabled()).toBe(false);
    expect(
      resolveDiagnosticsEnabled({ APP_VARIANT: 'release', TOOLBAR_MORPH_DIAGNOSTICS: '1' }),
    ).toBe(false);
    expect(resolveDiagnosticsEnabled(nativeSimReleaseDiagnosticsEnvironment)).toBe(true);
    expect(
      resolveDiagnosticsEnabled({
        ...nativeSimReleaseDiagnosticsEnvironment,
        GITHUB_REPOSITORY: 'LuanRigatti/emporiorigatti',
      }),
    ).toBe(false);
    expect(
      resolveDiagnosticsEnabled({
        ...nativeSimReleaseDiagnosticsEnvironment,
        GITHUB_EVENT_NAME: 'push',
      }),
    ).toBe(false);
    expect(
      resolveDiagnosticsEnabled({
        ...nativeSimReleaseDiagnosticsEnvironment,
        GITHUB_WORKFLOW_REF:
          'LuanRigatti/Emporio-Rigatti-NativeSim-Public/.github/workflows/eas-build.yml@refs/heads/sdk58-codex',
        TOOLBAR_MORPH_DIAGNOSTICS: '1',
      }),
    ).toBe(false);
    expect(
      resolveDiagnosticsEnabled({
        ...nativeSimReleaseDiagnosticsEnvironment,
        GITHUB_REF: 'refs/heads/main',
      }),
    ).toBe(false);
    expect(
      resolveDiagnosticsEnabled({
        ...nativeSimReleaseDiagnosticsEnvironment,
        BUILD_CONFIGURATION: 'development',
      }),
    ).toBe(false);
  });

  it('generates Objective-C-valid escaping in the native diagnostics header', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const loggerHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSToolbarMorphDiagnostics.h'),
        'utf8',
      );

      expect(loggerHeader).toContain(
        'regularExpressionWithPattern:@"0x[0-9a-fA-F]+\\\\s+(.+?)(?:\\\\s+\\\\+\\\\s+\\\\d+)?$"',
      );
      expect(loggerHeader).not.toMatch(/(?<!\\)\\(?:s|\+|d)/);
      expect(loggerHeader).toContain('[frame containsString:@"\\\\"]');
      expect(loggerHeader).not.toContain('[frame containsString:@"\\"]');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('patches the existing coordinator and Host idempotently', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const firstSnapshot = snapshotFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      expect(snapshotFixture(fixtureScreensRoot, fixtureExpoUIRoot)).toEqual(firstSnapshot);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('records shared-toolbar re-registration decisions and captures the full cached item list', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const headerConfig = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSScreenStackHeaderConfig.mm'),
        'utf8',
      );
      const coordinator = readFileSync(
        path.join(fixtureScreensRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      const pendingMaterializedIndex = coordinator.indexOf('materialized = pendingMaterialized');
      const captureLogIndex = coordinator.indexOf(
        'RNSLogToolbarMorphItems(@\"coordinator_capture\"',
        pendingMaterializedIndex,
      );

      expect(headerConfig).toContain('source_toolbar_registration_decision');
      expect(headerConfig).toContain('suppressed_shared_owner');
      expect(headerConfig).toContain('normal_registration');
      expect(headerConfig).toContain(
        'ToolbarMorphDiagnostics: shared toolbar left registration decision',
      );
      expect(headerConfig).toContain(
        'ToolbarMorphDiagnostics: shared toolbar right registration decision',
      );
      expect(headerConfig).toContain('navigation_item_setter');
      expect(pendingMaterializedIndex).toBeGreaterThanOrEqual(0);
      expect(captureLogIndex).toBeGreaterThan(pendingMaterializedIndex);
      expect(coordinator).toContain('RNSSharedToolbarPendingMaterializedItemsKey');
      expect(coordinator).toContain('coordinator_capture_owner_before');
      expect(coordinator).toContain('coordinator_capture_owner_after');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('qualifies HostView property access inside OSLog interpolation closures', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const host = readFileSync(path.join(fixtureExpoUIRoot, 'ios/HostView.swift'), 'utf8');
      const hostDiagnosticMessages = host
        .split('\n')
        .filter((line) => line.trimStart().startsWith('"event='));

      expect(hostDiagnosticMessages).toHaveLength(2);
      expect(hostDiagnosticMessages[0]).toContain('event=\\(event, privacy: .public)');
      expect(hostDiagnosticMessages[1]).toContain(
        'event=host_layout variant=\\(self.toolbarMorphExperimentVariant, privacy: .public) role=\\(role, privacy: .public)',
      );
      expect(
        hostDiagnosticMessages.filter((line) =>
          line.includes('host=\\(self.toolbarMorphToken, privacy: .public)'),
        ),
      ).toHaveLength(2);
      expect(
        hostDiagnosticMessages.some((line) => line.includes('host=\\(toolbarMorphToken')),
      ).toBe(false);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('keeps the coordinator repair and animation statements while adding event-only calls', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const coordinator = readFileSync(
        path.join(fixtureScreensRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      expect(coordinator).toContain('RNSSharedToolbarItemsNeedAttachment(leftItems, bar)');
      expect(coordinator).toContain('RNSSharedToolbarItemsNeedAttachment(rightItems, bar)');
      expect(coordinator).toContain('[sharedNavigationItem setLeftBarButtonItems:nil animated:NO]');
      expect(coordinator).toContain(
        '[sharedNavigationItem setRightBarButtonItems:nil animated:NO]',
      );
      expect(coordinator).toContain('animated:shouldAnimateToolbarItemReplacement');
      expect(coordinator).toContain(
        'UIKit owns the in-flight morph; native completion reconciles the selected destination.',
      );
      expect(coordinator).toContain(
        'self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil',
      );
      expect(coordinator).toContain('@"tab_transition_active"');
      expect(coordinator).toContain('@"navigation_transition_active"');
      expect(coordinator).toContain('RNSLogToolbarMorphItems(@"attachment_repair_decision"');
      expect(coordinator).toContain('RNSLogToolbarMorphItems(@"attachment_repair_applied"');
      expect(coordinator).toContain(
        'RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_before"',
      );
      expect(coordinator).toContain(
        'RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_after"',
      );
      expect(coordinator).toContain(
        'RNSLogToolbarMorphOwnership(@"coordinator_apply_owner_before"',
      );
      expect(coordinator).toContain('RNSLogToolbarMorphOwnership(@"coordinator_apply_owner_after"');
      expect(coordinator).toContain(
        'RNSLogToolbarMorphOwnership(@"attachment_repair_owner_before"',
      );
      expect(coordinator).toContain('RNSLogToolbarMorphOwnership(@"attachment_repair_owner_after"');
      expect(coordinator).toContain(
        '"materialization", @"captured", navigationController.navigationBar',
      );
      expect(coordinator).toContain('RNSObserveToolbarMorphTabTransition(');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('uses only the three approved accessory roles and native OSLog in Release code', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const loggerHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSToolbarMorphDiagnostics.h'),
        'utf8',
      );
      const headerSubview = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSScreenStackHeaderSubview.mm'),
        'utf8',
      );
      const host = readFileSync(path.join(fixtureExpoUIRoot, 'ios/HostView.swift'), 'utf8');
      expect(loggerHeader).toContain('os_log_with_type');
      expect(loggerHeader).toContain('ToolbarMorphDiagnostics');
      expect(loggerHeader).toContain('variant=%{public}@ role=%{public}@');
      expect(loggerHeader).toContain('RNSCurrentToolbarMorphExperimentVariant');
      expect(loggerHeader).toContain('EmporioToolbarMorphExperimentVariant');
      expect(loggerHeader).toContain(
        '"transition_completed", source, fromIndex, toIndex, animated',
      );
      expect(loggerHeader).toContain('NO, context.isCancelled);');
      expect(loggerHeader).toContain('home-search');
      expect(loggerHeader).toContain('settings-profile');
      expect(loggerHeader).toContain('finance-reference');
      expect(loggerHeader).toContain('@"Período financeiro", @"Selecionar período"');
      expect(loggerHeader).not.toContain('@"Selecionar mês"');
      expect(loggerHeader).not.toContain('@"Selecionar ano"');
      expect(loggerHeader).toContain('navigation_matches_shared=%{public}d');
      expect(loggerHeader).toContain('settings_shared_root_predicate=%{public}d');
      expect(loggerHeader).toContain('finance_shared_root_predicate=%{public}d');
      expect(loggerHeader).toContain('owner_contains=%{public}d other_owner_contains=%{public}d');
      expect(loggerHeader).toContain('RNSIsToolbarMorphDiagnosticsEnabled');
      expect(loggerHeader).toContain('EmporioToolbarMorphDiagnosticsEnabled');
      expect(loggerHeader).toContain('pid=%{public}d');
      expect(loggerHeader).toContain('NSThread.callStackSymbols');
      expect(headerSubview).toContain('wasAttached && self.window == nil');
      expect(headerSubview).toContain('custom_subview_will_move_superview');
      expect(headerSubview).toContain('custom_subview_did_move_superview');
      expect(headerSubview).toContain('custom_subview_will_move_window');
      expect(headerSubview).toContain('custom_subview_did_move_window');
      expect(headerSubview).toContain('rns_toolbarMorphExistingBarButtonItem');
      expect(headerSubview).toContain('RNSLogToolbarMorphAttachmentLoss');
      expect(loggerHeader).toContain('tab_transition_completed');
      expect(loggerHeader).not.toContain('displayName');
      expect(loggerHeader).not.toContain('photoUrl');
      expect(host).toContain('event=host_layout');
      expect(host).toContain('variant=\\(self.toolbarMorphExperimentVariant, privacy: .public)');
      expect(host).toContain('EmporioToolbarMorphExperimentVariant');
      expect(host).toContain('EmporioToolbarMorphDiagnosticsEnabled');
      expect(host).toContain('pid=\\(processIdentifier, privacy: .public)');
      expect(host).toContain('logToolbarMorphHostLifecycle("host_appeared")');
      expect(host).toContain('logToolbarMorphHostLifecycle("host_disappeared")');
      expect(host).toContain('let _ = props.prepareToolbarMorphHostIdentity()');
      const prepareIdentityStart = host.indexOf('func prepareToolbarMorphHostIdentity()');
      const prepareIdentityEnd = host.indexOf(
        'func logToolbarMorphHostLayout',
        prepareIdentityStart,
      );
      expect(host.slice(prepareIdentityStart, prepareIdentityEnd)).not.toContain(
        'guard toolbarMorphDiagnosticsEnabled',
      );
      expect(host).toContain('ToolbarMorphDiagnostics');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('correlates cold-start materialization and pop staging through native identities and attachment state', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const loggerHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSToolbarMorphDiagnostics.h'),
        'utf8',
      );
      const stack = readFileSync(path.join(fixtureScreensRoot, 'ios/RNSScreenStack.mm'), 'utf8');
      const coordinator = readFileSync(
        path.join(fixtureScreensRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );

      expect(loggerHeader).toContain('navigation=%{public}@ from=%{public}@ to=%{public}@');
      expect(loggerHeader).toContain(
        'operation=%{public}@ result=%{public}@ stack_depth=%{public}ld',
      );
      expect(loggerHeader).toContain('uptime_ms=%{public}llu');
      expect(loggerHeader).toContain('custom_view=%{public}@');
      expect(loggerHeader).toContain('attached=%{public}d');
      expect(loggerHeader).toContain(
        'window=%{public}d bar_window=%{public}d same_window=%{public}d',
      );

      expect(coordinator).toContain('toolbar_first_materialization');
      expect(coordinator).toContain('pop_staging_source');
      expect(coordinator).toContain('pop_staging_destination');
      expect(loggerHeader).toContain('event=pop_staging_predicates');
      expect(coordinator).toContain('RNSLogToolbarMorphPopPredicates(');
      expect(coordinator).toContain('pop_owner_before_transfer');
      expect(coordinator).toContain('pop_owner_after_transfer');
      expect(coordinator).toContain('attachment_repair_decision');
      expect(coordinator).toContain('attachment_repair_applied');
      expect(stack).toContain('navigation_will_show_callback');
      expect(stack).toContain('pop_staging_started');
      expect(stack).toContain('pop_staging_result');
      expect(stack).toContain('navigation_transition_will_show');
      expect(stack).toContain('navigation_transition_did_show');
      expect(loggerHeader).toContain('navigation_transition_completed');
      expect(stack).toContain('RNSObserveToolbarMorphNavigationTransition(');
      expect(stack).toContain('fromViewController, viewController, operation, stageResult');

      expect(loggerHeader).not.toContain('displayName');
      expect(loggerHeader).not.toContain('photoUrl');
      expect(loggerHeader).not.toContain('searchQuery');
      expect(loggerHeader).not.toContain('customer');
      expect(loggerHeader).not.toContain('financial');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('traces the real declarative Finance toolbar button through its native accessibility label', () => {
    const financeRoute = readFileSync(path.resolve('src/app/(tabs)/financeiro/index.tsx'), 'utf8');
    const financePeriodToolbar = readFileSync(
      path.resolve('src/features/finance/components/FinancePeriodToolbar.tsx'),
      'utf8',
    );
    const routerToolbarButtonConverter = readFileSync(
      path.resolve(
        'node_modules/expo-router/build/layouts/stack-utils/toolbar/StackToolbarButton/index.js',
      ),
      'utf8',
    );
    const routerToolbarMenuConverter = readFileSync(
      path.resolve(
        'node_modules/expo-router/build/layouts/stack-utils/toolbar/StackToolbarMenu/index.js',
      ),
      'utf8',
    );
    const routerSharedToolbarProps = readFileSync(
      path.resolve('node_modules/expo-router/build/layouts/stack-utils/toolbar/shared.js'),
      'utf8',
    );
    const screensBarButtonItem = readFileSync(
      path.resolve('node_modules/react-native-screens/ios/RNSBarButtonItem.mm'),
      'utf8',
    );
    expect(financeRoute).toContain('accessibilityLabel="Período financeiro"');
    expect(financePeriodToolbar).toContain('accessibilityLabel="Selecionar período"');
    expect(routerToolbarButtonConverter).toContain(
      'convertStackHeaderSharedPropsToRNSharedHeaderItem)(props)',
    );
    expect(routerToolbarMenuConverter).toContain("type: 'menu'");
    expect(routerToolbarMenuConverter).toContain(
      'convertStackHeaderSharedPropsToRNSharedHeaderItem)(rest, isBottomPlacement)',
    );
    expect(routerSharedToolbarProps).toContain('...rest,');
    expect(screensBarButtonItem).toContain('self.accessibilityLabel = dict[@"accessibilityLabel"]');

    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const loggerHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSToolbarMorphDiagnostics.h'),
        'utf8',
      );
      const headerConfig = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSScreenStackHeaderConfig.mm'),
        'utf8',
      );
      const coordinator = readFileSync(
        path.join(fixtureScreensRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );

      expect(loggerHeader).toContain('@"Período financeiro", @"Selecionar período"');
      expect(loggerHeader).toContain(
        'financeReferenceLabels containsObject:item.accessibilityLabel',
      );
      expect(headerConfig).toContain('RNSLogToolbarMorphItem(@"item_created"');
      expect(coordinator).toContain('RNSLogToolbarMorphItems(@"coordinator_capture"');
      expect(coordinator).toContain(
        'RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_before"',
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('records individual header setters, Fabric unmount and snapshot decisions without materializing items', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const loggerHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSToolbarMorphDiagnostics.h'),
        'utf8',
      );
      const headerConfig = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSScreenStackHeaderConfig.mm'),
        'utf8',
      );
      const headerSubviewHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSScreenStackHeaderSubview.h'),
        'utf8',
      );
      const coordinator = readFileSync(
        path.join(fixtureScreensRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );

      expect(headerConfig).toContain('navigation_item_setter');
      expect(headerConfig).toContain('header-config-updateViewController-navitem-left');
      expect(headerConfig).toContain('header-config-updateViewController-navitem-right');
      expect(headerConfig).toContain('fabric_unmount_before_remove');
      expect(headerConfig).toContain('[childComponentView removeFromSuperview];');
      expect(headerConfig).toContain('fabric_snapshot_candidate');
      expect(headerConfig).toContain('fabric_snapshot_customView_before');
      expect(headerConfig).toContain('fabric_snapshot_customView_after');
      const fabricUnmountStart = headerConfig.indexOf(
        'unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView',
      );
      const fabricUnmountEnd = headerConfig.indexOf(
        '\n- (void)mountingTransactionDidMount:',
        fabricUnmountStart,
      );
      expect(headerConfig.slice(fabricUnmountStart, fabricUnmountEnd)).not.toContain(
        'getUIBarButtonItem',
      );
      expect(headerSubviewHeader).toContain('rns_toolbarMorphExistingBarButtonItem');
      expect(coordinator).toContain('RNSBeginToolbarMorphDiagnosticOperation');
      expect(coordinator).toContain('navigation_item_setter');
      expect(coordinator).toContain('tab-controller-');
      expect(loggerHeader).toContain('navigation_item=%{public}@');
      expect(loggerHeader).toContain('accessory_window=%{public}@');
      expect(loggerHeader).toContain('operation=%{public}@ phase=%{public}@');
      expect(loggerHeader).toContain('before_contains=%{public}d observed_contains=%{public}d');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('connects cold-start replace, native materialization and Host lifecycle with safe route labels', () => {
    const splash = readFileSync(path.resolve('src/features/splash/SplashGate.tsx'), 'utf8');
    const module = readFileSync(
      path.resolve('modules/toolbar-morph-diagnostics/ios/ToolbarMorphDiagnosticsModule.swift'),
      'utf8',
    );
    const jsBridge = readFileSync(path.resolve('src/utils/toolbarMorphDiagnostics.ts'), 'utf8');

    expect(splash).toContain("'splash_replace_requested'");
    expect(splash).toContain("isAuthenticated ? 'home' : 'login'");
    expect(splash).toContain('router.replace(destinationHref);');
    expect(splash).not.toContain(
      "recordToolbarMorphNavigationLifecycle(\n      'splash_replace_requested',\n      destinationHref",
    );
    expect(module).toContain('recordNavigationLifecycle');
    expect(module).toContain('phase=before_replace');
    expect(module).toContain('processIdentifier');
    expect(module).toContain('systemUptime');
    expect(jsBridge).toContain('isToolbarMorphDiagnosticsEnabled');
  });

  it('records shared-root pop predicates, exclusive ownership transfer, and cancelled swipe-back recovery', () => {
    const { fixtureRoot, fixtureScreensRoot, fixtureExpoUIRoot } = createFixture();
    try {
      patchFixture(fixtureScreensRoot, fixtureExpoUIRoot);
      const loggerHeader = readFileSync(
        path.join(fixtureScreensRoot, 'ios/RNSToolbarMorphDiagnostics.h'),
        'utf8',
      );
      const coordinator = readFileSync(
        path.join(fixtureScreensRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      const stack = readFileSync(path.join(fixtureScreensRoot, 'ios/RNSScreenStack.mm'), 'utf8');
      const stageStart = coordinator.lastIndexOf(
        '- (NSString *)stageSharedToolbarItemsForNavigationPopInNavigationController:',
      );
      const stageEnd = coordinator.indexOf('\n#pragma mark - Signals', stageStart);
      const stageMethod = coordinator.slice(stageStart, stageEnd);
      const predicateLogIndex = stageMethod.indexOf('RNSLogToolbarMorphPopPredicates(');
      const routeBranchIndex = stageMethod.indexOf('if (isHomeSharedRootPop)');
      const releaseOwnerIndex = stageMethod.indexOf(
        'setRightBarButtonItems:remainingSourceRightItems',
      );
      const destinationOwnerIndex = stageMethod.indexOf(
        'setRightBarButtonItems:rightItems.count > 0 ? rightItems : nil animated:NO',
      );
      const didShowSyncIndex = stack.indexOf(
        '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];',
      );

      expect(loggerHeader).toContain('context.isCancelled ? @"cancelled" : @"completed"');
      expect(loggerHeader).toContain('navigation_matches_selected_nested=%{public}d');
      expect(loggerHeader).toContain('destination_is_tabs_root=%{public}d');
      expect(loggerHeader).toContain('stack_depth=%{public}ld nested_stack_depth=%{public}ld');
      expect(loggerHeader).toContain('source_owner=%{public}@ destination_owner=%{public}@');
      expect(coordinator).toContain('RNSLogToolbarMorphTabSelection(@"tab_selection_requested"');
      expect(coordinator).toContain('RNSLogToolbarMorphTabSelection(@"tab_selection_applied"');
      expect(stageMethod).toContain('RNSLogToolbarMorphPopPredicates');
      expect(predicateLogIndex).toBeGreaterThanOrEqual(0);
      expect(routeBranchIndex).toBeGreaterThan(predicateLogIndex);
      expect(stageMethod).toContain('RNSLogToolbarMorphOwnership(@"pop_owner_before_transfer"');
      expect(stageMethod).toContain(
        'RNSLogToolbarMorphOwnership(@"pop_owner_after_source_release"',
      );
      expect(stageMethod).toContain('RNSLogToolbarMorphOwnership(@"pop_owner_after_transfer"');
      expect(releaseOwnerIndex).toBeGreaterThanOrEqual(0);
      expect(destinationOwnerIndex).toBeGreaterThan(releaseOwnerIndex);
      expect(didShowSyncIndex).toBeGreaterThanOrEqual(0);
      expect(stack).toContain('RNSObserveToolbarMorphNavigationTransition(');
      expect(coordinator).toContain(
        'RNSSharedToolbarItemsByRemovingInstances(sourceNavigationItem.leftBarButtonItems',
      );
      expect(coordinator).toContain(
        'RNSSharedToolbarItemsByRemovingInstances(sourceNavigationItem.rightBarButtonItems',
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
