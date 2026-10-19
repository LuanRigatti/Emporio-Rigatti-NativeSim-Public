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

  it('stages only the materialized Home toolbar for the exact noninteractive Splash index replace', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const nativeController = readFileSync(
        path.join(fixtureRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      const eligibilityStart = nativeController.lastIndexOf(
        '- (NSString *)initialHomeToolbarReplaceEligibilityForViewController:',
      );
      const stagingStart = nativeController.lastIndexOf(
        '- (NSString *)stageInitialHomeToolbarItemsForViewController:',
      );
      const captureStart = nativeController.indexOf(
        '- (void)captureSharedToolbarItemsFromViewController:',
        stagingStart,
      );
      const initialRegistrationStart = nativeController.lastIndexOf(
        '- (BOOL)shouldSkipInitialHomeToolbarRegistration:',
      );
      const sharedGuardStart = nativeController.lastIndexOf(
        '- (BOOL)shouldSkipSharedToolbarItemRegistration:',
      );
      const eligibility = nativeController.slice(eligibilityStart, stagingStart);
      const staging = nativeController.slice(stagingStart, captureStart);
      const capture = nativeController.slice(captureStart, sharedGuardStart);
      const initialRegistrationGuard = nativeController.slice(
        initialRegistrationStart,
        stagingStart,
      );
      const reRegistrationGuard = nativeController.slice(
        sharedGuardStart,
        nativeController.indexOf(
          '- (NSDictionary<NSString *, NSArray<UIBarButtonItem *> *> *)sourceToolbarRegistrationItemsForViewController:',
          sharedGuardStart,
        ),
      );
      const stack = readFileSync(path.join(fixtureRoot, 'ios/RNSScreenStack.mm'), 'utf8');

      expect(eligibilityStart).toBeGreaterThanOrEqual(0);
      expect(nativeController).toContain('#import "RNSScreen.h"');
      expect(
        nativeController.indexOf('static BOOL RNSHomeToolbarNavigationItemContainsItem'),
      ).toBeLessThan(eligibilityStart);
      expect(
        nativeController.indexOf('static BOOL RNSHomeToolbarItemArraysHaveSameInstances'),
      ).toBeLessThan(eligibilityStart);
      expect(eligibility).toContain('installedControllers[0]');
      expect(eligibility).toContain(
        '[self isScreenControllerCurrentlySelected:installedControllers[0]]',
      );
      expect(eligibility).toContain(
        'RNSFindNestedNavigationController(installedControllers[0]) != navigationController',
      );
      expect(eligibility).toContain('sharedNavigationController.transitionCoordinator');
      expect(eligibility).toContain('UITransitionContextFromViewControllerKey');
      expect(eligibility).toContain('UITransitionContextToViewControllerKey');
      expect(eligibility).toContain('[sourceScreenId hasPrefix:@"index-"]');
      expect(eligibility).toContain('toViewController == tabsScreenViewController');
      expect(eligibility).toContain('sharedNavigationController.viewControllers.count == 1');
      expect(eligibility).toContain('rootTransitionCoordinator.isInteractive');
      expect(eligibility).toContain('tabTransitionCoordinator != rootTransitionCoordinator');
      expect(eligibility).toContain(
        'screenTransitionCoordinator != navigationController.transitionCoordinator',
      );
      expect(eligibility).toContain('nestedTransitionCoordinator != rootTransitionCoordinator');
      expect(eligibility).toContain('sourceNavigationBar.window != sharedWindow');
      expect(eligibility).toContain('viewController.viewIfLoaded.window != sharedWindow');

      expect(staging).toContain('home-toolbar-item:leading-anchor:44x44|');
      expect(staging).toContain('home-toolbar-item:search:Busca:magnifyingglass:94x44|');
      expect(staging).toContain('toolbar-morph:home-search');
      expect(staging).toContain(
        'RNSHomeToolbarItemArraysHaveSameInstances(cachedLeftItems, leftItems)',
      );
      expect(staging).toContain('RNSHomeToolbarNavigationItemContainsItem(owner, candidate)');
      expect(staging).toContain('sourceOwnsExactItems');
      expect(staging).toContain('destinationAlreadyOwnsExactItems');
      expect(staging).toContain('RNSLogToolbarMorphOwnership(@"initial_home_replace_owner_before"');
      expect(staging).toContain(
        'RNSLogToolbarMorphOwnership(@"initial_home_replace_owner_after_source_release"',
      );
      expect(staging).toContain(
        'RNSLogToolbarMorphOwnership(@"initial_home_replace_owner_after_destination_apply"',
      );
      expect(staging).toContain('@"before_transfer", navigationController.navigationBar');
      expect(staging).toContain('@"after_transfer", sharedNavigationController.navigationBar');
      expect(staging).not.toContain('UIBarButtonItem alloc');

      const sourceReleaseIndex = staging.indexOf(
        '[sourceNavigationItem setRightBarButtonItems:nil animated:NO]',
      );
      const targetApplyIndex = staging.indexOf(
        '[destinationNavigationItem setLeftBarButtonItems:leftItems animated:NO]',
      );
      expect(sourceReleaseIndex).toBeGreaterThanOrEqual(0);
      expect(targetApplyIndex).toBeGreaterThan(sourceReleaseIndex);
      expect(staging).toContain('[navigationController setNavigationBarHidden:YES animated:NO]');
      expect(staging).toContain('leftItems');
      expect(staging).toContain('rightItems');

      expect(capture).toContain('stageInitialHomeToolbarItemsForViewController:viewController');
      expect(capture).toContain('initial_home_toolbar_staged');
      expect(capture).toContain('isFirstHomeToolbarMaterialization');
      expect(capture).toContain(
        'RNSLogToolbarMorphNavigation(@"initial_home_replace_stage_result"',
      );
      expect(capture).toContain('rootTransitionCoordinator != nil');
      expect(capture).toContain(
        'if (![initialHomeStageResult isEqualToString:@"initial_home_toolbar_staged"])',
      );
      expect(capture).toContain('[item setLeftBarButtonItems:nil animated:NO]');
      expect(reRegistrationGuard).toContain('shouldSkipInitialHomeToolbarRegistration:item');
      expect(initialRegistrationGuard).toContain(
        'RNSHomeToolbarItemArraysHaveSameInstances(cachedLeftItems, destinationLeftItems)',
      );
      expect(initialRegistrationGuard).toContain(
        'RNSHomeToolbarNavigationItemContainsItem(owner, item)',
      );
      expect(stack).toContain(
        '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];',
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('generates Objective-C++-valid Splash route and Home toolbar signature checks', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);
      const nativeController = readFileSync(
        path.join(fixtureRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      const eligibilityStart = nativeController.lastIndexOf(
        '- (NSString *)initialHomeToolbarReplaceEligibilityForViewController:',
      );
      const stagingStart = nativeController.lastIndexOf(
        '- (NSString *)stageInitialHomeToolbarItemsForViewController:',
      );
      const captureStart = nativeController.indexOf(
        '- (void)captureSharedToolbarItemsFromViewController:',
        stagingStart,
      );
      const eligibility = nativeController.slice(eligibilityStart, stagingStart);
      const staging = nativeController.slice(stagingStart, captureStart);

      expect(eligibilityStart).toBeGreaterThanOrEqual(0);
      expect(stagingStart).toBeGreaterThan(eligibilityStart);
      expect(captureStart).toBeGreaterThan(stagingStart);
      expect(eligibility).toContain(
        'RNSScreenView *sourceScreenView = [fromViewController isKindOfClass:[RNSScreen class]]',
      );
      expect(eligibility).toContain('? [(RNSScreen *)fromViewController screenView] : nil;');
      expect(eligibility).toContain('NSString *sourceScreenId = sourceScreenView.screenId;');
      expect(eligibility).toContain('[sourceScreenId hasPrefix:@"index-"]');
      expect(eligibility).not.toContain('((RNSScreen *)fromViewController).screenId');

      const itemCountCheck = staging.indexOf(
        'if (leftItems.count != 1 || rightItems.count != 1 || leftItems[0] == rightItems[0])',
      );
      const leftSignatureDeclaration = staging.indexOf(
        'NSString *leftSignature = RNSHomeToolbarItemSemanticSignature(leftItems[0]) ?: @"";',
      );
      const rightSignatureDeclaration = staging.indexOf(
        'NSString *rightSignature = RNSHomeToolbarItemSemanticSignature(rightItems[0]) ?: @"";',
      );
      expect(itemCountCheck).toBeGreaterThanOrEqual(0);
      expect(leftSignatureDeclaration).toBeGreaterThan(itemCountCheck);
      expect(rightSignatureDeclaration).toBeGreaterThan(leftSignatureDeclaration);
      expect(staging).toContain(
        'if (![leftSignature hasPrefix:@"home-toolbar-item:leading-anchor:44x44|"] ||',
      );
      expect(staging).toContain(
        '![rightSignature hasPrefix:@"home-toolbar-item:search:Busca:magnifyingglass:94x44|"] ||',
      );
      expect(staging).not.toMatch(
        /!\[\[RNSHomeToolbarItemSemanticSignature\((?:left|right)Items\[0\]\) \?:/,
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('suppresses only re-registration of the exact captured custom item still attached to the shared bar', () => {
    const fixtureRoot = createScreensFixture();
    try {
      patchRNScreens(fixtureRoot);

      const coordinator = readPatchedCoordinator(fixtureRoot);
      const guardStart = coordinator.indexOf('- (BOOL)shouldSkipSharedToolbarItemRegistration:');
      const guardEnd = coordinator.indexOf(
        '- (NSDictionary<NSString *, NSArray<UIBarButtonItem *> *> *)sourceToolbarRegistrationItemsForViewController:',
        guardStart,
      );
      const guard = coordinator.slice(guardStart, guardEnd);
      const captureStart = coordinator.indexOf(
        '- (void)captureSharedToolbarItemsFromViewController:',
      );
      const captureEnd = coordinator.indexOf(
        '- (BOOL)shouldSkipSharedToolbarItemRegistration:',
        captureStart,
      );
      const capture = coordinator.slice(captureStart, captureEnd);
      const registrationStart = coordinator.indexOf(
        '- (NSDictionary<NSString *, NSArray<UIBarButtonItem *> *> *)sourceToolbarRegistrationItemsForViewController:',
      );
      const registrationEnd = coordinator.indexOf(
        '- (void)prepareSharedNavigationBarForViewController:',
        registrationStart,
      );
      const registration = coordinator.slice(registrationStart, registrationEnd);
      const headerConfig = readFileSync(
        path.join(fixtureRoot, 'ios/RNSScreenStackHeaderConfig.mm'),
        'utf8',
      );

      expect(guardStart).toBeGreaterThanOrEqual(0);
      expect(guard).toContain('sourceNavigationBarWasHidden');
      expect(guard).toContain('navigationController.viewControllers.count != 1');
      expect(guard).toContain('navigationController.transitionCoordinator != nil');
      expect(guard).toContain('self.transitionCoordinator == nil');
      expect(guard).toContain('sourceNavigationItem == sharedNavigationItem');
      expect(guard).toContain('candidate == item');
      expect(guard).toContain('itemWasCaptured');
      expect(guard).toContain('sharedNavigationItemOwnsItem');
      expect(guard).toContain('sourceNavigationItemAlreadyOwnsItem');
      expect(guard).toContain('customView.window != sharedNavigationBar.window');
      expect(guard).toContain('[customView isDescendantOfView:sharedNavigationBar]');
      expect(guard).toContain('customView.hidden || customView.alpha <= 0');
      expect(guard).toContain('return NO;');

      expect(capture).toContain('materialized = pendingMaterialized');
      expect(capture.indexOf('materialized = pendingMaterialized')).toBeLessThan(
        capture.indexOf('RNSSharedToolbarMaterializedItemsKey, materialized'),
      );
      expect(capture).toContain('[item setLeftBarButtonItems:nil animated:NO]');
      expect(capture).toContain('[item setRightBarButtonItems:nil animated:NO]');

      expect(registration).toContain('if (item == sharedItem)');
      expect(registration).toContain('pendingMaterialized = @{');
      expect(registration).toContain('\"left\": [leftItems copy]');
      expect(registration).toContain('\"right\": [rightItems copy]');
      expect(registration).toContain('RNSHomeToolbarItemArraysHaveSameInstances');

      expect(headerConfig).toContain('toolbarMorphItem = [subview getUIBarButtonItem]');
      expect(headerConfig).toContain('shouldSkipSharedToolbarItemRegistration:toolbarMorphItem');
      expect(headerConfig).toContain('side:@"left"');
      expect(headerConfig).toContain('side:@"right"');
      expect(headerConfig).not.toContain('side:@\\"left\\"');
      expect(guard).toContain('item.customView == nil');
      expect(headerConfig).toContain('headerLeftBarButtonItems');
      expect(headerConfig).toContain('headerRightBarButtonItems');
      expect(headerConfig).toContain(
        'toolbarMorphSourceItems[@\"left\"] ?: toolbarMorphDesiredLeftItems',
      );
      expect(headerConfig).toContain(
        'toolbarMorphSourceItems[@\"right\"] ?: toolbarMorphDesiredRightItems',
      );
      expect(headerConfig).toContain('withCurrentItems:toolbarMorphMaterializedLeftItems');
      expect(headerConfig).toContain('withCurrentItems:toolbarMorphMaterializedRightItems');
      expect(guard).toMatch(/item == nil \|\| item\.customView == nil/);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('stages Home, Settings, and Finance root toolbar items before a native pop', () => {
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
      expect(stageMethod).toContain('selectedTabIndex == 1');
      expect(stageMethod).toContain('sharedTabsControllerIsTop');
      expect(stageMethod).toContain('toViewController == tabsScreenViewController');
      expect(stageMethod).toContain(
        'selectedNestedNavigationController.viewControllers.count == 1',
      );
      expect(stageMethod).toContain('isSettingsSharedRootPop');
      expect(stageMethod).toContain('isFinanceSharedRootPop');
      expect(stageMethod).toContain('successResult = @"staged_settings_root"');
      expect(stageMethod).toContain('successResult = @"staged_finance_root"');
      expect(stageMethod).toContain(
        'objc_getAssociatedObject(sourceNavigationItem, &RNSSharedToolbarMaterializedItemsKey)',
      );
      expect(stageMethod).toContain('sharedNavigationController.navigationBarHidden');
      expect(stageMethod).toContain('RNSSharedToolbarItemsByRemovingInstances');
      expect(stageMethod).toContain(
        'RNSSharedToolbarItemsByRemovingInstances(sourceNavigationItem.leftBarButtonItems ?: @[], leftItems)',
      );
      expect(stageMethod).toContain(
        'RNSSharedToolbarItemsByRemovingInstances(sourceNavigationItem.rightBarButtonItems ?: @[], rightItems)',
      );
      expect(stageMethod).toContain('RNSHomeToolbarItemArraysHaveSameInstances');
      expect(stageMethod).toContain(
        'setRightBarButtonItems:rightItems.count > 0 ? rightItems : nil animated:NO',
      );
      expect(stageMethod.indexOf('setRightBarButtonItems:remainingSourceRightItems')).toBeLessThan(
        stageMethod.indexOf(
          'setRightBarButtonItems:rightItems.count > 0 ? rightItems : nil animated:NO',
        ),
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
      expect(stack).toContain('stageSharedToolbarItemsForNavigationPopInNavigationController:');
      expect(didShowSyncIndex).toBeGreaterThan(stageDecisionIndex);
      expect(stackSnapshotIndex).toBeGreaterThan(didShowSyncIndex);
      expect(stack).toContain(
        'RNSSharedToolbarNavigationOperation(\n      navigationController, previousStack, viewController',
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('limits the Settings and Finance staging predicates to a pop returning to the tabs root', () => {
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
      const popGuard = stack.indexOf('if ([operation isEqualToString:@"pop"])');
      const stageCall = stack.indexOf(
        'stageSharedToolbarItemsForNavigationPopInNavigationController:',
        popGuard,
      );
      const guardEnd = stack.indexOf('\n  }', popGuard);

      expect(popGuard).toBeGreaterThanOrEqual(0);
      expect(stageCall).toBeGreaterThan(popGuard);
      expect(stageCall).toBeLessThan(guardEnd);
      expect(stageMethod).toContain('navigationController == sharedNavigationController');
      expect(stageMethod).toContain('sharedTabsControllerIsTop');
      expect(stageMethod).toContain('toViewController == tabsScreenViewController');
      expect(stageMethod).toContain('selectedTabIndex == 3');
      expect(stageMethod).toContain('selectedTabIndex == 1');
      expect(stageMethod).toContain(
        'selectedNestedNavigationController.viewControllers.count == 1',
      );
      expect(stageMethod).toContain('return @"not_target_root_pop"');
      expect(stageMethod).not.toContain('setSelectedIndex:');
      expect(stageMethod).not.toContain('replace');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ['Home', 'isHomeSharedRootPop', 'selectedTabIndex == 0', 'staged_home_root'],
    ['Settings', 'isSettingsSharedRootPop', 'selectedTabIndex == 3', 'staged_settings_root'],
    ['Finance', 'isFinanceSharedRootPop', 'selectedTabIndex == 1', 'staged_finance_root'],
  ])(
    'keeps the %s root-pop route tied to its tab and destination predicate',
    (label, predicate, tabIndex, result) => {
      const fixtureRoot = createScreensFixture();
      try {
        patchRNScreens(fixtureRoot);
        const coordinator = readPatchedCoordinator(fixtureRoot);
        const stageStart = coordinator.lastIndexOf(
          '- (NSString *)stageSharedToolbarItemsForNavigationPopInNavigationController:',
        );
        const stageEnd = coordinator.indexOf('\n#pragma mark - Signals', stageStart);
        const stageMethod = coordinator.slice(stageStart, stageEnd);
        const predicateStart = stageMethod.indexOf(`BOOL ${predicate} =`);
        const predicateEnd = stageMethod.indexOf(';', predicateStart);
        const routePredicate = stageMethod.slice(predicateStart, predicateEnd + 1);

        expect(predicateStart).toBeGreaterThanOrEqual(0);
        expect(routePredicate).toContain('navigationController == sharedNavigationController');
        if (predicate === 'isHomeSharedRootPop') {
          expect(routePredicate).toContain('sharedTabsControllerIsTop');
        } else {
          expect(routePredicate).not.toContain('sharedTabsControllerIsTop');
        }
        expect(routePredicate).toContain('toViewController == tabsScreenViewController');
        expect(routePredicate).toContain(tabIndex);
        expect(stageMethod).toContain(`successResult = @"${result}"`);
        expect(stageMethod).toContain(`if (${predicate})`);
      } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
      }
    },
  );

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
      expect(upgradedCoordinator).toContain(
        'NSArray<RNSTabsScreenViewController *> *installedControllers = [self installedScreenControllers];',
      );
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
