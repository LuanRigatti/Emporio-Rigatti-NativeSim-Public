import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const pluginSource = readFileSync('plugins/withRNScreensHideBottomBarWhenPushed.js', 'utf8');
const screensRoot = path.resolve('node_modules/react-native-screens');
const screensPackage = JSON.parse(readFileSync(path.join(screensRoot, 'package.json'), 'utf8')) as {
  version: string;
};
const screensControllerPath = path.join(screensRoot, 'ios/tabs/host/RNSTabBarController.mm');
const screensControllerSource = readFileSync(screensControllerPath, 'utf8');
const requireFromTest = createRequire(__filename);
const pluginTestHooks = requireFromTest('../../plugins/withRNScreensHideBottomBarWhenPushed') as {
  __patchRNScreensForTests: (root: string) => void;
};
const patchRNScreens = pluginTestHooks.__patchRNScreensForTests;

const patchedFiles = [
  'package.json',
  'src/fabric/ScreenNativeComponent.ts',
  'ios/RNSScreen.h',
  'ios/RNSScreen.mm',
  'ios/RNSScreenStack.mm',
  'ios/RNSScreenStackHeaderConfig.mm',
  'ios/tabs/host/RNSTabBarController.h',
  'ios/tabs/host/RNSTabBarController.mm',
];

function createScreensFixture() {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'emporio-rnscreens-toolbar-'));

  for (const relativePath of patchedFiles) {
    const sourcePath = path.join(screensRoot, relativePath);
    const targetPath = path.join(fixtureRoot, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }

  return fixtureRoot;
}

function snapshotPatchedFiles(root: string) {
  return Object.fromEntries(
    patchedFiles.map((relativePath) => [
      relativePath,
      readFileSync(path.join(root, relativePath), 'utf8'),
    ]),
  );
}

function applyLegacyToolbarCoordinator(fixtureRoot: string) {
  const controllerPath = path.join(fixtureRoot, 'ios/tabs/host/RNSTabBarController.mm');
  let controller = readFileSync(controllerPath, 'utf8');
  const replacements = [
    [
      'for (UIViewController *tab in [self installedScreenControllers])',
      'for (UIViewController *tab in self.viewControllers)',
    ],
    [
      `NSArray<RNSTabsScreenViewController *> *installedControllers = [self installedScreenControllers];
  if (selectedIndex < installedControllers.count) {
    [self prepareSharedNavigationBarForViewController:installedControllers[selectedIndex] reason:@"tab-selection-index"];
  }`,
      `if (selectedIndex < self.viewControllers.count) {
    [self prepareSharedNavigationBarForViewController:self.viewControllers[selectedIndex] reason:@"tab-selection-index"];
  }`,
    ],
    [
      'NSInteger tabIndex = [[self installedScreenControllers] indexOfObject:viewController];',
      'NSInteger tabIndex = [self.viewControllers indexOfObject:viewController];',
    ],
    [
      'BOOL isSelectedHomeTab = tabIndex == 0 && [self isScreenControllerCurrentlySelected:viewController];',
      'BOOL isSelectedHomeTab = tabIndex == 0 && self.selectedIndex == (NSUInteger)tabIndex;',
    ],
    [
      '(isTransitionCompletion || ([self isScreenControllerCurrentlySelected:viewController] &&',
      '(isTransitionCompletion || (self.selectedViewController == viewController &&',
    ],
    [
      `UIViewController *selectedViewController = [self effectiveSelectedViewController];
  if (selectedViewController != nil) {
    [self prepareSharedNavigationBarForViewController:selectedViewController reason:reason];
  }`,
      `if (self.selectedViewController != nil) {
    [self prepareSharedNavigationBarForViewController:self.selectedViewController reason:reason];
  }`,
    ],
  ];

  for (const [currentFragment, legacyFragment] of replacements) {
    if (!controller.includes(currentFragment)) {
      throw new Error(`Current coordinator fixture is missing: ${currentFragment}`);
    }
    controller = controller.replace(currentFragment, legacyFragment);
  }

  const currentTransitionGuard = `BOOL isNavigationTransitionCompletion = [reason isEqualToString:@"navigation-did-show"];
  BOOL isTabTransitionCompletion = [reason isEqualToString:@"tab-transition-completion"];
  BOOL isTransitionCompletion = isNavigationTransitionCompletion || isTabTransitionCompletion;
  if (!isNavigationTransitionCompletion &&
      (sharedNavigationController.transitionCoordinator != nil ||
       nestedNavigationController.transitionCoordinator != nil)) {
    return; // UIKit owns the in-flight navigation morph; didShow reconciles the destination.
  }
  id<UIViewControllerTransitionCoordinator> tabTransitionCoordinator = self.transitionCoordinator;
  if (tabTransitionCoordinator == nil && !isNavigationTransitionCompletion) {
    tabTransitionCoordinator = viewController.transitionCoordinator;
  }
  if (!isTabTransitionCompletion && tabTransitionCoordinator != nil) {
    RNSObserveSharedToolbarTabTransition(self, viewController);
    return; // UIKit owns the in-flight morph; native completion reconciles the selected destination.
  }`;
  const legacyTransitionGuard = `BOOL isTransitionCompletion = [reason isEqualToString:@"navigation-did-show"];
  if (!isTransitionCompletion && (sharedNavigationController.transitionCoordinator != nil ||
                                 nestedNavigationController.transitionCoordinator != nil)) {
    return; // UIKit owns the in-flight morph; didShow reconciles the actual destination.
  }`;
  if (!controller.includes(currentTransitionGuard)) {
    throw new Error('Current coordinator fixture is missing the tab transition guard.');
  }
  controller = controller.replace(currentTransitionGuard, legacyTransitionGuard);

  const resolverDeclarations = `// Emporio Rigatti: shared toolbar ownership resolvers
@property (nonatomic, readwrite) BOOL shouldProgressStateOnMoreNavigationControllerPush;
- (nonnull NSArray<RNSTabsScreenViewController *> *)installedScreenControllers;
- (nullable UIViewController *)effectiveSelectedViewController;
- (BOOL)isScreenControllerCurrentlySelected:(nonnull UIViewController *)screenController;`;
  if (!controller.includes(resolverDeclarations)) {
    throw new Error('Current coordinator fixture is missing its resolver declarations.');
  }
  controller = controller.replace(
    resolverDeclarations,
    '@property (nonatomic, readwrite) BOOL shouldProgressStateOnMoreNavigationControllerPush;',
  );

  writeFileSync(controllerPath, controller);
}

function readPatchedCoordinator(fixtureRoot: string) {
  const controllerPath = path.join(fixtureRoot, 'ios/tabs/host/RNSTabBarController.mm');
  const controller = readFileSync(controllerPath, 'utf8');
  const start = controller.indexOf('Emporio Rigatti: shared tab toolbar controller');
  const end = controller.indexOf('#pragma mark - Signals', start);
  if (start === -1 || end === -1) throw new Error('Patched coordinator block was not found.');
  return controller.slice(start, end);
}

function readPatchedIndexSetter(fixtureRoot: string) {
  const controllerPath = path.join(fixtureRoot, 'ios/tabs/host/RNSTabBarController.mm');
  const controller = readFileSync(controllerPath, 'utf8');
  const start = controller.indexOf('Emporio Rigatti: shared tab toolbar index');
  const end = controller.indexOf(
    '- (void)setSelectedViewController:(__kindof UIViewController *)selectedViewController',
    start,
  );
  if (start === -1 || end === -1) throw new Error('Patched index-selection hook was not found.');
  return controller.slice(start, end);
}

describe('Home toolbar coordinator patch', () => {
  it('uses stable semantic item markers to recognize rematerialized Home toolbar items', () => {
    expect(pluginSource).toContain('Emporio Rigatti: Home toolbar semantic comparison');
    expect(pluginSource).toContain('home-toolbar-item:');
    expect(pluginSource).toContain('RNSHomeToolbarItemArraysAreSemanticallyEqual');
    expect(pluginSource).toContain('RNSHomeToolbarItemSetsAreSemanticallyEqual');
    expect(pluginSource).toContain(
      'RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceLeft, sharedLeft)',
    );
    expect(pluginSource).toContain(
      'RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceRight, sharedRight)',
    );
  });

  it('disables animation only for equivalent items during selected Home header resync', () => {
    expect(pluginSource).toContain('Emporio Rigatti: Home toolbar replacement policy');
    expect(pluginSource).toContain('[reason isEqualToString:@"header-materialization/resync"]');
    expect(pluginSource).toContain('[self isScreenControllerCurrentlySelected:viewController]');
    expect(pluginSource).toContain(
      '!(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual)',
    );
    expect(pluginSource).toContain(
      'setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement',
    );
    expect(pluginSource).toContain(
      'setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement',
    );
    expect(pluginSource).toContain('RNSHomeToolbarItemArraysHaveSameInstances');
  });

  it('uses the installed UITab-aware selection and controller resolvers from Screens 4.30.0', () => {
    expect(screensPackage.version).toBe('4.30.0');
    expect(screensControllerSource).toContain(
      '- (nonnull NSArray<RNSTabsScreenViewController *> *)installedScreenControllers',
    );
    expect(screensControllerSource).toContain('return _installedScreenControllers ?: @[];');
    expect(screensControllerSource).toContain('return self.viewControllers ?: @[];');
    expect(screensControllerSource).toContain(
      '- (nullable UIViewController *)effectiveSelectedViewController',
    );
    expect(screensControllerSource).toContain('return self.selectedTab.viewController;');
    expect(screensControllerSource).toContain('return self.selectedViewController;');

    expect(pluginSource).toContain('[self installedScreenControllers]');
    expect(pluginSource).toContain('[self effectiveSelectedViewController]');
    expect(pluginSource).toContain('[self isScreenControllerCurrentlySelected:viewController]');
    expect(pluginSource).toContain('installedControllers[selectedIndex]');
    expect(pluginSource).toContain(
      '- (void)setSelectedTab:(UITab *)selectedTab API_AVAILABLE(ios(18.0))',
    );
  });

  it('applies the Screens 4.30.0 plugin patch idempotently', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const firstSnapshot = snapshotPatchedFiles(fixtureRoot);
      patchRNScreens(fixtureRoot);
      expect(snapshotPatchedFiles(fixtureRoot)).toEqual(firstSnapshot);

      const coordinator = readPatchedCoordinator(fixtureRoot);
      expect(coordinator).toContain('[self installedScreenControllers]');
      expect(coordinator).toContain('[self effectiveSelectedViewController]');
      expect(coordinator).toContain('[self isScreenControllerCurrentlySelected:viewController]');
      expect(coordinator).toContain(
        'id<UIViewControllerTransitionCoordinator> tabTransitionCoordinator = self.transitionCoordinator;',
      );
      expect(coordinator).toContain(
        'if (tabTransitionCoordinator == nil && !isNavigationTransitionCompletion)',
      );
      expect(coordinator).toContain('RNSObserveSharedToolbarTabTransition(self, viewController)');
      expect(coordinator).not.toMatch(
        /\bself\.(?:viewControllers|selectedViewController|selectedIndex)\b/,
      );

      const indexSetter = readPatchedIndexSetter(fixtureRoot);
      expect(indexSetter).toContain('[self installedScreenControllers]');
      expect(indexSetter).toContain('installedControllers[selectedIndex]');
      expect(indexSetter).not.toContain('self.viewControllers');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('stages only Home and Settings root toolbar items before a native pop', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const coordinator = readPatchedCoordinator(fixtureRoot);
      const stageMethodStart = coordinator.lastIndexOf(
        '- (NSString *)stageSharedToolbarItemsForNavigationPopInNavigationController:',
      );
      const stageMethodEnd = coordinator.indexOf('\n#pragma mark - Signals', stageMethodStart);
      const stageMethod = coordinator.slice(stageMethodStart, stageMethodEnd);
      const stack = readFileSync(path.join(fixtureRoot, 'ios/RNSScreenStack.mm'), 'utf8');
      const operationHelperStart = stack.indexOf(
        'static NSString *RNSSharedToolbarNavigationOperation(',
      );
      const operationHelperEnd = stack.indexOf(
        'static RNSTabBarController *RNSFindSharedToolbarTabsController',
        operationHelperStart,
      );
      const operationHelper = stack.slice(operationHelperStart, operationHelperEnd);
      const willShowIndex = stack.indexOf('withConfig:screenView.findHeaderConfig];');
      const stageDecisionIndex = stack.indexOf(
        'NSString *operation = RNSSharedToolbarNavigationOperation(',
        willShowIndex,
      );
      const didShowSyncIndex = stack.indexOf(
        '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];',
      );
      const stackSnapshotIndex = stack.indexOf(
        '&RNSSharedToolbarStableNavigationStackKey,\n      [navigationController.viewControllers copy]',
        didShowSyncIndex,
      );

      expect(stageMethodStart).toBeGreaterThanOrEqual(0);
      expect(stageMethod).toContain('navigationController == sharedNavigationController');
      expect(stageMethod).toContain('selectedTabIndex == 0');
      expect(stageMethod).toContain('selectedTabIndex == 3');
      expect(stageMethod).toContain(
        'selectedNestedNavigationController.viewControllers.count == 1',
      );
      expect(stageMethod).toContain(
        'objc_getAssociatedObject(sourceNavigationItem, &RNSSharedToolbarMaterializedItemsKey)',
      );
      expect(stageMethod).toContain('sharedNavigationController.navigationBarHidden');
      expect(stageMethod).toContain('RNSSharedToolbarItemsByRemovingInstances');
      expect(stageMethod).toContain('RNSHomeToolbarItemArraysHaveSameInstances');
      expect(stageMethod).toContain(
        'setRightBarButtonItems:rightItems.count > 0 ? rightItems : nil animated:NO',
      );
      expect(stageMethod).toContain('return @"not_target_root_pop"');
      expect(stageMethod).not.toContain('setRightBarButtonItems:rightItems animated:YES');

      expect(operationHelper).toContain('return @"initial"');
      expect(operationHelper).toContain('return @"pop"');
      expect(operationHelper).toContain('return @"push"');
      expect(operationHelper).toContain('return @"replace"');
      expect(operationHelper).toContain('toIndex < fromIndex');
      expect(stageDecisionIndex).toBeGreaterThan(willShowIndex);
      expect(stack).toContain('if ([operation isEqualToString:@"pop"])');
      expect(didShowSyncIndex).toBeGreaterThan(stageDecisionIndex);
      expect(stackSnapshotIndex).toBeGreaterThan(didShowSyncIndex);
      expect(stack).toContain(
        'RNSSharedToolbarNavigationOperation(\n      navigationController, previousStack, viewController',
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('keeps destination toolbar preparation before native UITab and legacy selection', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const controller = readFileSync(
        path.join(fixtureRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      const selectionHooks = [
        [
          'Emporio Rigatti: shared tab toolbar UITab selection',
          '[self prepareSharedNavigationBarForViewController:selectedTab.viewController reason:@"programmatic-selection"]',
          '[super setSelectedTab:selectedTab]',
        ],
        [
          'Emporio Rigatti: shared tab toolbar index',
          '[self prepareSharedNavigationBarForViewController:installedControllers[selectedIndex] reason:@"tab-selection-index"]',
          '[super setSelectedIndex:selectedIndex]',
        ],
        [
          'Emporio Rigatti: shared tab toolbar should select',
          '[self prepareSharedNavigationBarForViewController:viewController reason:@"tab-selection-shouldSelect"]',
          '_isHandlingExplicitSelectionUpdate = YES;',
        ],
      ];

      for (const [marker, prepareCall, selectionCall] of selectionHooks) {
        const markerIndex = controller.indexOf(marker);
        const prepareIndex = controller.indexOf(prepareCall, markerIndex);
        const selectionIndex = controller.indexOf(selectionCall, markerIndex);
        expect(markerIndex).toBeGreaterThanOrEqual(0);
        expect(prepareIndex).toBeGreaterThan(markerIndex);
        expect(selectionIndex).toBeGreaterThan(prepareIndex);
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('defers tab-root reconciliation to the native transition completion and repairs only detached sides', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const coordinator = readPatchedCoordinator(fixtureRoot);
      const tabTransitionGuardIndex = coordinator.indexOf(
        'if (!isTabTransitionCompletion && tabTransitionCoordinator != nil)',
      );
      const itemReplacementIndex = coordinator.indexOf(
        'if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems))',
      );
      const attachmentRepairIndex = coordinator.indexOf('BOOL repairLeft =');
      const navigationTransitionGuardIndex = coordinator.indexOf(
        'if (!isNavigationTransitionCompletion &&',
      );

      expect(tabTransitionGuardIndex).toBeGreaterThanOrEqual(0);
      expect(tabTransitionGuardIndex).toBeLessThan(itemReplacementIndex);
      expect(tabTransitionGuardIndex).toBeLessThan(attachmentRepairIndex);
      expect(navigationTransitionGuardIndex).toBeGreaterThanOrEqual(0);
      expect(navigationTransitionGuardIndex).toBeLessThan(tabTransitionGuardIndex);
      expect(coordinator).toContain('animateAlongsideTransition:nil completion:');
      expect(coordinator).toContain(
        'objc_getAssociatedObject(controller, &RNSSharedToolbarPendingTabTransitionKey) == transitionCoordinator',
      );
      expect(coordinator).toContain(
        '[strongController synchronizeSharedNavigationBarWithReason:@"tab-transition-completion"]',
      );
      expect(coordinator).toContain('[strongController effectiveSelectedViewController]');
      expect(coordinator).toContain(
        'if (activeCoordinator != nil && activeCoordinator != completedCoordinator)',
      );
      expect(coordinator).toContain(
        'objc_getAssociatedObject(controller, &RNSSharedToolbarPendingTabTransitionKey)',
      );
      expect(coordinator).toContain('RNSSharedToolbarItemsNeedAttachment(leftItems, bar)');
      expect(coordinator).toContain('RNSSharedToolbarItemsNeedAttachment(rightItems, bar)');
      expect(coordinator).toContain('if (repairLeft && !skipAttachmentRepairLeft) {');
      expect(coordinator).toContain('if (repairRight && !skipAttachmentRepairRight) {');
      expect(coordinator).toContain('[sharedNavigationItem setLeftBarButtonItems:nil animated:NO]');
      expect(coordinator).toContain(
        '[sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO]',
      );
      expect(coordinator).toContain(
        '[sharedNavigationItem setRightBarButtonItems:rightItems animated:NO]',
      );
      expect(coordinator).toContain(
        'if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems))',
      );
      expect(coordinator).toContain(
        'if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems))',
      );
      expect(coordinator).not.toMatch(/dispatch_after|NSTimer|setTimeout|remount/i);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('limits variant B to one post-UITab repair skip per target role and keeps the next sync as recovery', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const coordinator = readPatchedCoordinator(fixtureRoot);
      const skipHelper = coordinator.slice(
        coordinator.indexOf('static BOOL RNSShouldSkipSharedToolbarExperimentRepairOnce'),
        coordinator.indexOf('static UINavigationController *RNSFindNestedNavigationController'),
      );

      expect(skipHelper).toContain(
        'RNSCurrentToolbarMorphExperimentVariant() isEqualToString:@"B"',
      );
      expect(skipHelper).toContain('[reason isEqualToString:@"tab-transition-completion"]');
      expect(skipHelper).toContain('RNSRoleForToolbarMorphItem(item)');
      expect(skipHelper).toContain('isEqualToString:@"home-search"');
      expect(skipHelper).toContain('isEqualToString:@"settings-profile"');
      expect(skipHelper).toContain('experiment_b_skip_once');
      expect(skipHelper).toContain('experiment_b_recovery');
      expect(skipHelper).toContain('experiment_b_shared_side_preserved');
      expect(skipHelper).toContain('RNSSharedToolbarExperimentSkippedRepairRolesKey');
      expect(coordinator).toContain('if (repairLeft && !skipAttachmentRepairLeft) {');
      expect(coordinator).toContain('if (repairRight && !skipAttachmentRepairRight) {');
      expect(coordinator).toContain('RNSSharedToolbarItemsNeedAttachment(leftItems, bar)');
      expect(coordinator).toContain('RNSSharedToolbarItemsNeedAttachment(rightItems, bar)');
      expect(coordinator).not.toMatch(/dispatch_after|NSTimer|setTimeout|remount/i);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('upgrades previously marked coordinator patches without duplicating them', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      applyLegacyToolbarCoordinator(fixtureRoot);
      patchRNScreens(fixtureRoot);

      const upgradedCoordinator = readPatchedCoordinator(fixtureRoot);
      expect(upgradedCoordinator).toContain('[self installedScreenControllers]');
      expect(upgradedCoordinator).toContain('[self effectiveSelectedViewController]');
      expect(upgradedCoordinator).toContain(
        '[self isScreenControllerCurrentlySelected:viewController]',
      );
      expect(upgradedCoordinator).toContain(
        'id<UIViewControllerTransitionCoordinator> tabTransitionCoordinator = self.transitionCoordinator;',
      );
      expect(upgradedCoordinator).toContain(
        'RNSObserveSharedToolbarTabTransition(self, viewController)',
      );
      expect(upgradedCoordinator).not.toMatch(
        /\bself\.(?:viewControllers|selectedViewController|selectedIndex)\b/,
      );

      const upgradedIndexSetter = readPatchedIndexSetter(fixtureRoot);
      expect(upgradedIndexSetter).toContain('[self installedScreenControllers]');
      expect(upgradedIndexSetter).toContain('installedControllers[selectedIndex]');
      expect(upgradedIndexSetter).not.toContain('self.viewControllers');

      const firstUpgradedSnapshot = snapshotPatchedFiles(fixtureRoot);
      patchRNScreens(fixtureRoot);
      expect(snapshotPatchedFiles(fixtureRoot)).toEqual(firstUpgradedSnapshot);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
