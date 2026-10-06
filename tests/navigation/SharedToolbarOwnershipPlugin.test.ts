import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const reactNativeScreensRoot = dirname(require.resolve('react-native-screens/package.json'));
const plugin = jest.requireActual('../../plugins/withRNScreensHideBottomBarWhenPushed') as {
  __patchRNScreensForTesting: (screensRoot: string) => void;
};

const patchedFiles = [
  'src/fabric/ScreenNativeComponent.ts',
  'ios/RNSScreen.h',
  'ios/RNSScreen.mm',
  'ios/RNSScreenStackHeaderConfig.mm',
  'ios/RNSScreenStack.mm',
  'ios/RNSBarButtonItem.h',
  'ios/RNSBarButtonItem.mm',
  'ios/tabs/host/RNSTabBarController.h',
  'ios/tabs/host/RNSTabBarController.mm',
];

describe('shared toolbar ownership config plugin', () => {
  it('applies nested-root suppression and remains idempotent on a clean react-native-screens source copy', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'emporio-rns-toolbar-'));

    try {
      for (const relativePath of patchedFiles) {
        const destination = join(temporaryRoot, relativePath);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(join(reactNativeScreensRoot, relativePath), destination);
      }

      plugin.__patchRNScreensForTesting(temporaryRoot);
      const firstApplication = patchedFiles.map((relativePath) =>
        readFileSync(join(temporaryRoot, relativePath), 'utf8'),
      );
      plugin.__patchRNScreensForTesting(temporaryRoot);
      const secondApplication = patchedFiles.map((relativePath) =>
        readFileSync(join(temporaryRoot, relativePath), 'utf8'),
      );

      expect(secondApplication).toEqual(firstApplication);

      const headerConfig = readFileSync(
        join(temporaryRoot, 'ios/RNSScreenStackHeaderConfig.mm'),
        'utf8',
      );
      expect(headerConfig).toContain(
        'RNSShouldSuppressNestedRootNavigationBar(vc, navctr, &toolbarTabsController)',
      );
      expect(headerConfig).toContain(
        'navigationController.viewControllers.firstObject != viewController',
      );
      expect(headerConfig).toContain('sharedNavigationController == navigationController');
      expect(headerConfig).toMatch(
        /if \(RNSShouldSuppressNestedRootNavigationBar\(vc, navctr, &toolbarTabsController\)\) \{\s*\[navctr setNavigationBarHidden:YES animated:NO\];[\s\S]*?\} else \{\s*\[navctr setNavigationBarHidden:NO animated:animated\];\s*\}/,
      );

      const toolbarItemsApplied = headerConfig.indexOf('navitem.leftBarButtonItems =');
      const nestedRootDecision = headerConfig.indexOf(
        'RNSShouldSuppressNestedRootNavigationBar(vc, navctr, &toolbarTabsController)',
      );
      expect(toolbarItemsApplied).toBeGreaterThanOrEqual(0);
      expect(nestedRootDecision).toBeGreaterThan(toolbarItemsApplied);

      const tabController = readFileSync(
        join(temporaryRoot, 'ios/tabs/host/RNSTabBarController.mm'),
        'utf8',
      );
      expect(tabController).not.toContain('id<UIAccessibilityContainer>');
      expect(tabController).toContain(
        '((NSInteger (*)(id, SEL))objc_msgSend)(view, @selector(accessibilityElementCount))',
      );
      expect(tabController).toContain(
        '((id (*)(id, SEL, NSInteger))objc_msgSend)(view, @selector(accessibilityElementAtIndex:), index)',
      );
      expect(tabController).toContain(
        '[view respondsToSelector:@selector(accessibilityElementCount)]',
      );
      const prepareMethodStart = tabController.indexOf(
        '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason',
      );
      const synchronizeMethodStart = tabController.indexOf(
        '- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason',
        prepareMethodStart,
      );
      const rootPreparation = tabController.slice(prepareMethodStart, synchronizeMethodStart);
      const rootBranchStart = rootPreparation.indexOf('if (nestedNavigationController != nil) {');
      const rootBranch = rootPreparation.slice(rootBranchStart);
      expect(rootBranchStart).toBeGreaterThanOrEqual(0);
      expect(rootBranch).toContain('RNSSharedToolbarMaterializedItemsKey');
      expect(rootBranch).toContain(
        '[nestedNavigationController setNavigationBarHidden:YES animated:NO]',
      );
      expect(rootBranch).toContain(
        '[sharedNavigationItem setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement]',
      );
      expect(rootBranch).toContain(
        '[sharedNavigationItem setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement]',
      );
      expect(rootBranch).not.toContain('[nestedNavigationController setNavigationBarHidden:NO');
      expect(tabController).toContain(
        'if (!isTabRoot) {\n    [sharedNavigationController setNavigationBarHidden:YES animated:NO];\n    [nestedNavigationController setNavigationBarHidden:NO animated:NO];',
      );
      for (const selectionReason of [
        'tab-selection-index',
        'programmatic-selection',
        'tab-selection-shouldSelect',
        'tab-selection-commit',
      ]) {
        expect(tabController).toContain(selectionReason);
      }

      const screenStack = readFileSync(join(temporaryRoot, 'ios/RNSScreenStack.mm'), 'utf8');
      const normalPreparation = screenStack.indexOf(
        'RNSPrepareSharedToolbarBeforeRootPop(_controller, top, @"normal-pop")',
      );
      const normalPop = screenStack.indexOf(
        '[_controller popViewControllerAnimated:YES]',
        normalPreparation,
      );
      expect(normalPreparation).toBeGreaterThanOrEqual(0);
      expect(normalPop).toBeGreaterThan(normalPreparation);
      expect(screenStack).not.toContain(
        '[tabsController prepareSharedNavigationBarForPopToViewController:viewController',
      );
      expect(screenStack).toContain('@"interactive-native-gesture-accepted"');
      expect(screenStack).toContain('@"interactive-custom-swipe-began"');
      expect(screenStack).toContain('@"interactive-screen-transition"');
      expect(screenStack).toContain('cancelInteractiveTransition');
      expect(screenStack).toContain(
        '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"]',
      );
      expect(screenStack).toContain(
        'RNSMarkSharedToolbarRootDidShow(navigationController, viewController, tabsController)',
      );
      expect(screenStack).toContain('sharedNavigationController.transitionCoordinator != nil');
      expect(screenStack).toContain('homeToolbar.rootDidShow');
      expect(screenStack).toContain('_controller.interactivePopGestureRecognizer.delegate = self');

      const preflightStart = tabController.indexOf(
        '- (BOOL)prepareSharedNavigationBarForPopToViewController:',
      );
      const preflightEnd = tabController.indexOf(
        '- (void)prepareSharedNavigationBarForViewController:',
        preflightStart,
      );
      const preflight = tabController.slice(preflightStart, preflightEnd);
      expect(preflight.indexOf('RNSSharedToolbarStagedItemsKey')).toBeLessThan(
        preflight.indexOf('RNSSharedToolbarMaterializedItemsKey'),
      );
      expect(preflight).toContain('staged-destination-materialization');
      expect(preflight).toContain('sharedRootController != self.parentViewController');
      expect(preflight).toContain('RNSRetainSafeSharedToolbarItemInstances(');
      expect(preflight).toContain('sharedBeforeRight, cachedRight, snapshotRight');
      expect(preflight).toContain(
        '[sharedNavigationItem setRightBarButtonItems:rightItems animated:NO]',
      );
      expect(preflight).toContain('sharedNavigationController.navigationBar layoutIfNeeded');
      expect(preflight.indexOf('setRightBarButtonItems:rightItems animated:NO')).toBeLessThan(
        preflight.indexOf('navigation.destination-prepared'),
      );

      const headerRefresh = readFileSync(
        join(temporaryRoot, 'ios/RNSScreenStackHeaderConfig.mm'),
        'utf8',
      );
      expect(headerRefresh).toContain('consumeSharedToolbarPrePopPreparationForViewController:vc');
      expect(headerRefresh).toContain('preservePreparedSharedToolbarItems');
      expect(headerRefresh).toContain(
        'Emporio Rigatti: preserve prepared toolbar during destination willShow',
      );
      expect(headerRefresh).toContain(
        'Emporio Rigatti: keep prepared destination toolbar configuration',
      );
      expect(headerRefresh).toContain(
        'Emporio Rigatti: do not duplicate prepared left toolbar item',
      );
      expect(headerRefresh).toContain(
        'Emporio Rigatti: do not duplicate prepared right toolbar item',
      );

      const barButtonItem = readFileSync(join(temporaryRoot, 'ios/RNSBarButtonItem.mm'), 'utf8');
      expect(barButtonItem).toContain('rns_refreshConfigurationFromItem:');
      expect(barButtonItem).toContain('_rnsCanRefreshConfiguration');
      expect(barButtonItem).toContain('dict[@"imageSource"] == nil');
      expect(barButtonItem).toContain('dict[@"badge"] == nil');
      expect(barButtonItem).toContain('_itemAction = [source->_itemAction copy]');
      expect(barButtonItem).toContain('_buttonId = [source->_buttonId copy]');
      expect(barButtonItem).toContain('self.menu = source.menu');

      const screen = readFileSync(join(temporaryRoot, 'ios/RNSScreen.mm'), 'utf8');
      expect(screen).toContain('[self setGestureEnabled:newScreenProps.gestureEnabled]');
      expect(screen).toContain('newScreenProps.hidesBottomBarWhenPushed');
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
