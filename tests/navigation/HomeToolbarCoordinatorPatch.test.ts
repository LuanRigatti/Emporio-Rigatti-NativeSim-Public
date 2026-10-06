import { readFileSync } from 'node:fs';

const pluginSource = readFileSync('plugins/withRNScreensHideBottomBarWhenPushed.js', 'utf8');
const readinessSource = readFileSync('src/platform/nativeToolbarReadiness.ts', 'utf8');
const readinessModuleSource = readFileSync(
  'modules/native-toolbar-readiness/ios/NativeToolbarReadinessModule.swift',
  'utf8',
);
const splashSource = readFileSync('src/features/splash/SplashGate.tsx', 'utf8');

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('Home toolbar coordinator patch', () => {
  it('keeps Home toolbar identity semantic so equivalent rematerialization does not replace it', () => {
    expect(pluginSource).toContain('Emporio Rigatti: Home toolbar semantic comparison');
    expect(pluginSource).toContain('home-toolbar-item:');
    expect(pluginSource).toContain('RNSHomeToolbarItemArraysAreSemanticallyEqual');
    expect(pluginSource).toContain(
      'RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceLeft, sharedLeft)',
    );
    expect(pluginSource).toContain(
      'RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceRight, sharedRight)',
    );
  });

  it('prepares the destination toolbar immediately before the normal UIKit POP', () => {
    const normalPopPreparation = pluginSource.indexOf(
      'RNSPrepareSharedToolbarBeforeRootPop(_controller, top, @"normal-pop")',
    );
    const normalPop = pluginSource.indexOf(
      '[_controller popViewControllerAnimated:YES]',
      normalPopPreparation,
    );

    expect(normalPopPreparation).toBeGreaterThanOrEqual(0);
    expect(normalPop).toBeGreaterThan(normalPopPreparation);
    expect(pluginSource).not.toContain(
      '[tabsController prepareSharedNavigationBarForPopToViewController:viewController inNavigationController:navigationController]',
    );
    const preflight = sectionBetween(
      pluginSource,
      '- (BOOL)prepareSharedNavigationBarForPopToViewController:(UIViewController *)viewController inNavigationController:(UINavigationController *)navigationController\n{',
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason\n{',
    );
    expect(preflight).toContain('UINavigationItem *rootItem = rootController.navigationItem');
    expect(preflight.indexOf('RNSSharedToolbarStagedItemsKey')).toBeLessThan(
      preflight.indexOf('RNSSharedToolbarMaterializedItemsKey'),
    );
    expect(preflight).toContain('NSDictionary *snapshot = staged');
    expect(preflight).toContain('staged-destination-materialization');
    expect(preflight).toContain('live-destination-materialization');
    expect(preflight).toContain('sharedRootController != self.parentViewController');
    expect(preflight).toContain(
      '[sharedNavigationItem setRightBarButtonItems:rightItems animated:NO]',
    );
    expect(preflight).toContain(
      '[sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO]',
    );
    expect(preflight).toContain('[sharedNavigationController.navigationBar layoutIfNeeded]');
    expect(preflight).toContain(
      'objc_setAssociatedObject(rootItem, &RNSSharedToolbarMaterializedItemsKey, preparedSnapshot',
    );
    expect(preflight).toContain(
      'objc_setAssociatedObject(rootItem, &RNSSharedToolbarStagedItemsKey, nil',
    );
    expect(pluginSource).toContain(
      '[nestedCoordinator viewControllerForKey:UITransitionContextFromViewControllerKey]',
    );
    expect(pluginSource).toContain('transitionSource != viewController');
    expect(pluginSource).toContain('[destinationItem setLeftBarButtonItems:leftItems animated:NO]');
    expect(pluginSource).toContain(
      '[destinationItem setRightBarButtonItems:rightItems animated:NO]',
    );
    expect(pluginSource).toContain('RNSRetainSafeSharedToolbarItemInstances(');
    expect(pluginSource).toContain('RNSSharedToolbarPrePopPreparedKey');
    expect(pluginSource).toContain('navigation.destination-prepared');
    expect(preflight).toContain('[viewController.view layoutIfNeeded]');
    expect(preflight).toContain('[sharedNavigationController.navigationBar layoutIfNeeded]');
    expect(pluginSource).toContain('navigation.didShow');
  });

  it('preflights accepted native and custom interactive pops, while cancellation reconciles the source', () => {
    const nativeGesture = pluginSource.indexOf(
      'RNSPrepareSharedToolbarBeforeRootPop(_controller, interactiveDestination, @"interactive-native-gesture-accepted")',
    );
    const nativeGestureReturn = pluginSource.indexOf('return YES;', nativeGesture);
    const customSwipe = pluginSource.indexOf(
      'RNSPrepareSharedToolbarBeforeRootPop(_controller, interactiveDestination, @"interactive-custom-swipe-began")',
    );
    const customSwipePop = pluginSource.indexOf(
      '[_controller popViewControllerAnimated:YES]',
      customSwipe,
    );
    const screenTransition = pluginSource.indexOf(
      'RNSPrepareSharedToolbarBeforeRootPop(_controller, interactiveDestination, @"interactive-screen-transition")',
    );
    const screenTransitionPop = pluginSource.indexOf(
      '[_controller popViewControllerAnimated:YES]',
      screenTransition,
    );

    expect(nativeGesture).toBeGreaterThanOrEqual(0);
    expect(nativeGestureReturn).toBeGreaterThan(nativeGesture);
    expect(customSwipePop).toBeGreaterThan(customSwipe);
    expect(screenTransitionPop).toBeGreaterThan(screenTransition);
    expect(pluginSource).toContain(
      '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"]',
    );
  });

  it('retains only safe A-owned items and refreshes current action and menu configuration', () => {
    expect(pluginSource).toContain('candidate.customView == destinationItem.customView');
    expect(pluginSource).toContain('rns_refreshConfigurationFromItem:');
    expect(pluginSource).toContain('_buttonId = [source->_buttonId copy]');
    expect(pluginSource).toContain('_itemAction = [source->_itemAction copy]');
    expect(pluginSource).toContain('self.menu = source.menu');
    expect(pluginSource).toContain(
      'self.changesSelectionAsPrimaryAction = source.changesSelectionAsPrimaryAction',
    );
    expect(pluginSource).toContain('sharedBeforeLeft, cachedLeft, snapshotLeft');
    expect(pluginSource).toContain('sharedBeforeRight, cachedRight, snapshotRight');
    expect(pluginSource).toContain('consumeSharedToolbarPrePopPreparationForViewController:vc');
    expect(pluginSource).toContain('if (!preservePreparedSharedToolbarItems)');
    expect(pluginSource).toContain('prePopHeaderLeftSubview');
    expect(pluginSource).toContain('prePopHeaderRightSubview');
  });

  it('stages materialization during transitions without clearing the live navigation item', () => {
    const captureMethod = sectionBetween(
      pluginSource,
      '- (void)captureSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController\n{',
      '- (void)commitStagedSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController\n{',
    );

    expect(captureMethod).toContain('navigationController.transitionCoordinator != nil');
    expect(captureMethod).toContain('RNSSharedToolbarStagedItemsKey');
    expect(captureMethod).toContain('return; // Do not detach or reparent live items');
    const stagingBranch = captureMethod.slice(
      captureMethod.indexOf('if (navigationController.transitionCoordinator'),
      captureMethod.indexOf('return; // Do not detach or reparent live items'),
    );
    expect(stagingBranch).not.toContain('setRightBarButtonItems');
    expect(stagingBranch).not.toContain('setLeftBarButtonItems');
    expect(captureMethod.indexOf('RNSSharedToolbarStagedItemsKey')).toBeLessThan(
      captureMethod.indexOf('[item setLeftBarButtonItems:nil animated:NO]'),
    );
    expect(pluginSource).toContain(
      '[tabsController commitStagedSharedToolbarItemsFromViewController:viewController',
    );
    const stagedCommit = sectionBetween(
      pluginSource,
      '- (void)commitStagedSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController\n{',
      '- (BOOL)prepareSharedNavigationBarForPopToViewController:',
    );
    expect(stagedCommit).toContain(
      'RNSViewControllerContainsToolbarTabsController(viewController, self)',
    );
    expect(stagedCommit).toContain(
      'RNSFindNestedNavigationController(self.selectedViewController)',
    );
    expect(stagedCommit).toContain(
      'RNSHomeToolbarItemArraysHaveSameInstances(currentLeft, cachedLeft)',
    );
  });

  it('reconciles only after didShow and skips replacement when the shared items are already identical', () => {
    const sharedPreparation = sectionBetween(
      pluginSource,
      'BOOL isTransitionCompletion = [reason isEqualToString:@"navigation-did-show"];',
      '- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason\n{',
    );

    expect(sharedPreparation).toContain('[reason isEqualToString:@"navigation-did-show"]');
    expect(pluginSource).toContain(
      'if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems))',
    );
    expect(pluginSource).toContain(
      'if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems))',
    );
    expect(sharedPreparation).toContain('isTransitionCompletion');
    expect(pluginSource).toContain(
      '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"]',
    );
  });

  it('recovers the Finance root toolbar from its cached item without hardcoding Finance flow branches', () => {
    const preflight = sectionBetween(
      pluginSource,
      '- (BOOL)prepareSharedNavigationBarForPopToViewController:(UIViewController *)viewController inNavigationController:(UINavigationController *)navigationController\n{',
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason\n{',
    );

    expect(preflight).toContain('rootController.navigationItem');
    expect(preflight).toContain('RNSSharedToolbarStagedItemsKey');
    expect(preflight).toContain('RNSSharedToolbarMaterializedItemsKey');
    expect(pluginSource).toContain('Selecionar período');
    expect(pluginSource).toContain('Selecionar mês');
    expect(pluginSource).toContain('Selecionar ano');
    expect(preflight).not.toMatch(/if\s*\([^)]*finance/i);
  });

  it('suppresses a tab root navigation bar before react-native-screens can reveal it', () => {
    expect(pluginSource).toContain('Emporio Rigatti: suppress nested root bar before reveal');
    expect(pluginSource).toContain(
      'RNSShouldSuppressNestedRootNavigationBar(vc, navctr, &toolbarTabsController)',
    );
    expect(pluginSource).toContain(
      'navigationController.viewControllers.firstObject != viewController',
    );
    expect(pluginSource).toContain('sharedNavigationController == navigationController');
    expect(pluginSource).toContain(
      'return isDestination || transitionDestination == viewController;',
    );
    expect(pluginSource).toContain('[navctr setNavigationBarHidden:YES animated:NO]');
    expect(pluginSource).toContain('RNSLogNestedRootBarSuppression(navctr, toolbarTabsController)');
    expect(pluginSource).toContain('nav-role=B');
    expect(pluginSource).toContain('shared-role=A');
  });

  it('holds the authenticated reveal until the shared root has didShow and Search is attached', () => {
    expect(pluginSource).toContain('view.window == bar.window');
    expect(pluginSource).toContain('[view isDescendantOfView:bar]');
    expect(pluginSource).toContain('view.bounds.size.width > 0');
    expect(pluginSource).toContain('view.bounds.size.height > 0');
    expect(pluginSource).toContain('home-search-toolbar');
    expect(pluginSource).toContain('accessibilityFrame');
    expect(pluginSource).toContain('CGRectIntersectsRect(elementFrame, barFrame)');
    expect(pluginSource).toContain('leftItems.count == 0');
    expect(pluginSource).not.toContain('leading-anchor');
    expect(pluginSource).toContain('bar.hidden || bar.alpha <= 0');
    expect(pluginSource).toContain('sharedNavigationController.topViewController != tabsScreen');
    expect(pluginSource).toContain('sharedNavigationController.transitionCoordinator != nil');
    expect(pluginSource).toContain('com.emporio.rigatti.homeToolbar.rootDidShow');
    expect(pluginSource).toContain(
      'RNSMarkSharedToolbarRootDidShow(navigationController, viewController, tabsController)',
    );
    expect(pluginSource).toContain('context.isCancelled');
    expect(pluginSource).toContain('isEqualToString:@"wholesale"');
    expect(pluginSource).toContain('RNSMaybePublishHomeToolbarReadiness');
    expect(pluginSource).toContain('com.emporio.rigatti.homeToolbar.ready');
    expect(pluginSource).not.toContain('setTimeout');
    expect(readinessSource).toContain('beginHomeToolbarReadiness(composition)');
    expect(readinessModuleSource).toContain(
      'defaults.set(false, forKey: homeToolbarRootDidShowKey)',
    );
    expect(readinessModuleSource).toContain('Function("logSplashHide")');
    expect(readinessModuleSource).toContain(
      'NSLog("[TOOLBAR-TRACE] splash.hide composition=%@ %@", composition, trace)',
    );
    expect(pluginSource).toContain('com.emporio.rigatti.homeToolbar.readinessTrace');
    expect(pluginSource).toContain('items={L:%@ R:%@} search-element=%p view=%p');
    expect(readinessSource).toContain('logHomeToolbarSplashHide');
    expect(splashSource).toContain('waitForHomeToolbarReadiness(appMode)');
    expect(splashSource.indexOf('logHomeToolbarSplashHide(appMode)')).toBeLessThan(
      splashSource.indexOf('await SplashScreen.hideAsync()'),
    );
    expect(splashSource.indexOf('router.replace(destinationHref)')).toBeLessThan(
      splashSource.indexOf('await SplashScreen.hideAsync()'),
    );
  });

  it('keeps only short Simulator native lifecycle trace lines', () => {
    expect(pluginSource).toContain('#if TARGET_OS_SIMULATOR');
    expect(pluginSource).toContain('NSLog(@"[TOOLBAR-TRACE]');
    expect(pluginSource).toContain('RNSAuditToolbarItemDetails');
    expect(pluginSource).toContain('item=%p view=%p');
    expect(pluginSource).toContain('super=%p/%@ window=%p bounds=%@');
    expect(pluginSource).toContain('itemViews={%@}');
    expect(pluginSource).toContain('from={L:%@ R:%@} to={L:%@ R:%@}');
    expect(pluginSource).toContain('shouldTraceItemViews');
    for (const event of [
      'navigation.transition.begin',
      'navigation.willShow',
      'navigation.destination-prepared',
      'navigation.didShow',
      'pre-pop.prepare.begin',
      'pre-pop.prepare.done',
      'interactive-pop.prepare',
      'toolbar.roles.before',
      'toolbar.roles.after',
    ]) {
      expect(pluginSource).toContain(event);
    }
    expect(pluginSource).not.toContain('RNSAuditTransitionCoordinator');
    expect(pluginSource).not.toContain('RNSAuditNavigationItem');
    expect(pluginSource).not.toContain('RNSAuditNavigationBar(');
    expect(pluginSource).not.toContain('view-tree');
  });
});
