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
        '"materialization", @"captured", navigationController.navigationBar',
      );
      expect(coordinator).toContain('RNSObserveToolbarMorphTransition(');
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
      expect(loggerHeader).not.toContain('displayName');
      expect(loggerHeader).not.toContain('photoUrl');
      expect(host).toContain('event=host_layout');
      expect(host).toContain('variant=\\(self.toolbarMorphExperimentVariant, privacy: .public)');
      expect(host).toContain('EmporioToolbarMorphExperimentVariant');
      expect(host).toContain('logToolbarMorphHostLifecycle("host_appeared")');
      expect(host).toContain('logToolbarMorphHostLifecycle("host_disappeared")');
      expect(host).toContain('let _ = props.prepareToolbarMorphHostIdentity()');
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
    const routerToolbarButtonConverter = readFileSync(
      path.resolve(
        'node_modules/expo-router/build/layouts/stack-utils/toolbar/StackToolbarButton/index.js',
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
    expect(routerToolbarButtonConverter).toContain(
      'convertStackHeaderSharedPropsToRNSharedHeaderItem)(props)',
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

      expect(loggerHeader).toContain(
        'item.accessibilityLabel isEqualToString:@"Período financeiro"',
      );
      expect(headerConfig).toContain('RNSLogToolbarMorphItem(@"item_created"');
      expect(coordinator).toContain('RNSLogToolbarMorphItems(@"coordinator_capture"');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
