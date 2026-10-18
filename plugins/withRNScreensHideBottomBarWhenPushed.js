const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PATCH_MARKERS = {
  prop: 'Emporio Rigatti: hidesBottomBarWhenPushed prop',
  setter: 'Emporio Rigatti: hidesBottomBarWhenPushed setter',
  update: 'Emporio Rigatti: hidesBottomBarWhenPushed update',
  sharedToolbarHeader: 'Emporio Rigatti: shared tab toolbar header',
  sharedToolbarController: 'Emporio Rigatti: shared tab toolbar controller',
  sharedToolbarIndex: 'Emporio Rigatti: shared tab toolbar index',
  sharedToolbarViewController: 'Emporio Rigatti: shared tab toolbar view controller',
  sharedToolbarTabSelection: 'Emporio Rigatti: shared tab toolbar UITab selection',
  sharedToolbarTransitionObserver: 'Emporio Rigatti: shared tab toolbar transition observer',
  sharedToolbarShouldSelect: 'Emporio Rigatti: shared tab toolbar should select',
  sharedToolbarFlush: 'Emporio Rigatti: shared tab toolbar flush',
  sharedToolbarConfigImport: 'Emporio Rigatti: shared tab toolbar config import',
  sharedToolbarConfig: 'Emporio Rigatti: shared tab toolbar config helpers',
  sharedToolbarConfigHelpers: 'Emporio Rigatti: shared tab toolbar config helpers',
  sharedToolbarConfigHidden: 'Emporio Rigatti: shared tab toolbar config hidden',
  sharedToolbarConfigVisible: 'Emporio Rigatti: shared tab toolbar config visible',
  sharedToolbarPopStaging: 'Emporio Rigatti: shared toolbar pop destination staging',
  sharedToolbarPopMethod: 'Emporio Rigatti: shared toolbar pop staging method',
  homeToolbarSemanticComparison: 'Emporio Rigatti: Home toolbar semantic comparison',
  homeToolbarReplacementPolicy: 'Emporio Rigatti: Home toolbar replacement policy',
};

const LEGACY_SHARED_TOOLBAR_TRANSITION_GUARD = `  BOOL isTransitionCompletion = [reason isEqualToString:@"navigation-did-show"];
  if (!isTransitionCompletion && (sharedNavigationController.transitionCoordinator != nil ||
                                 nestedNavigationController.transitionCoordinator != nil)) {
    return; // UIKit owns the in-flight morph; didShow reconciles the actual destination.
  }`;

const SHARED_TOOLBAR_TRANSITION_GUARD = `  BOOL isNavigationTransitionCompletion = [reason isEqualToString:@"navigation-did-show"];
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

const SHARED_TOOLBAR_NAVIGATION_OPERATION_HELPER = `#import <objc/runtime.h>

static char RNSSharedToolbarStableNavigationStackKey;

static NSString *RNSSharedToolbarNavigationOperation(
    UINavigationController *navigationController,
    NSArray<UIViewController *> *previousStack,
    UIViewController *toViewController,
    UIViewController **fromViewControllerOut)
{
  if (fromViewControllerOut != NULL) *fromViewControllerOut = nil;
  if (previousStack.count == 0) return @"initial";

  UIViewController *fromViewController = previousStack.lastObject;
  if (fromViewControllerOut != NULL) *fromViewControllerOut = fromViewController;
  NSUInteger fromIndex = [previousStack indexOfObjectIdenticalTo:fromViewController];
  NSUInteger toIndex = [previousStack indexOfObjectIdenticalTo:toViewController];
  NSArray<UIViewController *> *currentStack = navigationController.viewControllers;

  if (toIndex != NSNotFound && fromIndex != NSNotFound && toIndex < fromIndex) {
    return @"pop";
  }

  BOOL previousStackIsPrefix = currentStack.count > previousStack.count;
  for (NSUInteger index = 0; previousStackIsPrefix && index < previousStack.count; index++) {
    previousStackIsPrefix = currentStack[index] == previousStack[index];
  }
  if (toIndex == NSNotFound && previousStackIsPrefix) return @"push";
  if (toIndex == NSNotFound && fromIndex == previousStack.count - 1 &&
      [currentStack indexOfObjectIdenticalTo:toViewController] != NSNotFound) {
    return @"replace";
  }
  return @"other";
}`;

function ensureSharedToolbarPopMethodDeclaration(headerPath) {
  const contents = fs.readFileSync(headerPath, 'utf8');
  const declaration =
    '- (NSString *)stageSharedToolbarItemsForNavigationPopInNavigationController:' +
    '(UINavigationController *)navigationController fromViewController:' +
    '(UIViewController *)fromViewController toViewController:(UIViewController *)toViewController;';
  if (contents.includes(declaration)) return;
  const anchor = '- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;';
  if (!contents.includes(anchor)) {
    throw new Error(`Não foi possível declarar o staging da toolbar em ${headerPath}.`);
  }
  fs.writeFileSync(headerPath, contents.replace(anchor, `${anchor}\n${declaration}`));
}

function ensureSharedToolbarNavigationOperationHelper(stackPath) {
  const contents = fs.readFileSync(stackPath, 'utf8');
  if (contents.includes('static NSString *RNSSharedToolbarNavigationOperation(')) return;
  const anchor =
    'static RNSTabBarController *RNSFindSharedToolbarTabsController(' +
    'UIViewController *controller)';
  if (!contents.includes(anchor)) {
    throw new Error(`Não foi possível preparar a pilha de navegação em ${stackPath}.`);
  }
  fs.writeFileSync(
    stackPath,
    contents.replace(anchor, `${SHARED_TOOLBAR_NAVIGATION_OPERATION_HELPER}\n\n${anchor}`),
  );
}

function patchFile(filePath, needle, replacement, marker) {
  const contents = fs.readFileSync(filePath, 'utf8');

  if (contents.includes(marker)) return;

  if (!contents.includes(needle)) {
    throw new Error(`Não foi possível aplicar a integração de tab bar em ${filePath}.`);
  }

  const markedReplacement = replacement.includes(marker)
    ? replacement
    : `// ${marker}\n${replacement}`;

  fs.writeFileSync(filePath, contents.replace(needle, markedReplacement));
}

function replaceMarkedPatchFragment(filePath, marker, previousFragment, currentFragment) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const markerIndex = contents.indexOf(marker);

  if (markerIndex === -1) return;

  const previousIndex = contents.indexOf(previousFragment, markerIndex);
  if (previousIndex !== -1) {
    const updatedContents =
      contents.slice(0, previousIndex) +
      currentFragment +
      contents.slice(previousIndex + previousFragment.length);
    fs.writeFileSync(filePath, updatedContents);
    return;
  }

  if (contents.indexOf(currentFragment, markerIndex) !== -1) return;

  throw new Error(`Não foi possível atualizar a integração de toolbar marcada em ${filePath}.`);
}

function upgradeSharedToolbarUITabResolvers(controller) {
  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: shared toolbar ownership capture',
    'for (UIViewController *tab in self.viewControllers)',
    'for (UIViewController *tab in [self installedScreenControllers])',
  );
  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: shared tab toolbar index',
    'if (selectedIndex < self.viewControllers.count) {\n    [self prepareSharedNavigationBarForViewController:self.viewControllers[selectedIndex] reason:@"tab-selection-index"];\n  }',
    'NSArray<RNSTabsScreenViewController *> *installedControllers = [self installedScreenControllers];\n  if (selectedIndex < installedControllers.count) {\n    [self prepareSharedNavigationBarForViewController:installedControllers[selectedIndex] reason:@"tab-selection-index"];\n  }',
  );
  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: shared tab toolbar controller',
    'NSInteger tabIndex = [self.viewControllers indexOfObject:viewController];',
    'NSInteger tabIndex = [[self installedScreenControllers] indexOfObject:viewController];',
  );
  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: Home toolbar replacement policy',
    'BOOL isSelectedHomeTab = tabIndex == 0 && self.selectedIndex == (NSUInteger)tabIndex;',
    'BOOL isSelectedHomeTab = tabIndex == 0 && [self isScreenControllerCurrentlySelected:viewController];',
  );
  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: shared toolbar ownership reconcile',
    '(isTransitionCompletion || (self.selectedViewController == viewController &&',
    '(isTransitionCompletion || ([self isScreenControllerCurrentlySelected:viewController] &&',
  );
  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: shared tab toolbar controller',
    'if (self.selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:self.selectedViewController reason:reason];\n  }',
    'UIViewController *selectedViewController = [self effectiveSelectedViewController];\n  if (selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:selectedViewController reason:reason];\n  }',
  );
}

function upgradeSharedToolbarTabTransition(controller) {
  const contents = fs.readFileSync(controller, 'utf8');
  const markerIndex = contents.indexOf('Emporio Rigatti: shared toolbar ownership transition');
  if (markerIndex === -1) return;

  // The OSLog plugin injects event calls inside these branches, so use stable anchors.
  const hasCurrentGuard =
    contents.indexOf('BOOL isNavigationTransitionCompletion =', markerIndex) !== -1 &&
    contents.indexOf(
      'id<UIViewControllerTransitionCoordinator> tabTransitionCoordinator = self.transitionCoordinator;',
      markerIndex,
    ) !== -1 &&
    contents.indexOf('RNSObserveSharedToolbarTabTransition(self, viewController);', markerIndex) !==
      -1;
  if (hasCurrentGuard) return;

  replaceMarkedPatchFragment(
    controller,
    'Emporio Rigatti: shared toolbar ownership transition',
    LEGACY_SHARED_TOOLBAR_TRANSITION_GUARD,
    SHARED_TOOLBAR_TRANSITION_GUARD,
  );
}

function patchSharedToolbarOwnership(screensRoot) {
  const header = path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.h');
  const controller = path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm');
  const config = path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm');
  const stack = path.join(screensRoot, 'ios', 'RNSScreenStack.mm');
  const patch = (file, needle, replacement, name) =>
    patchFile(file, needle, replacement, `Emporio Rigatti: shared toolbar ownership ${name}`);

  upgradeSharedToolbarUITabResolvers(controller);
  upgradeSharedToolbarTabTransition(controller);

  patch(
    controller,
    '@property (nonatomic, readwrite) BOOL shouldProgressStateOnMoreNavigationControllerPush;',
    `@property (nonatomic, readwrite) BOOL shouldProgressStateOnMoreNavigationControllerPush;\n- (nonnull NSArray<RNSTabsScreenViewController *> *)installedScreenControllers;\n- (nullable UIViewController *)effectiveSelectedViewController;\n- (BOOL)isScreenControllerCurrentlySelected:(nonnull UIViewController *)screenController;`,
    'resolvers',
  );

  patch(
    header,
    '- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;',
    `- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;
- (void)captureSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController;`,
    'capture-header',
  );
  patch(
    controller,
    'static UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{',
    `// Retained configuration is not a second UIKit navigation-item owner.
static char RNSSharedToolbarMaterializedItemsKey;

static BOOL RNSSharedToolbarItemsNeedAttachment(NSArray<UIBarButtonItem *> *items, UINavigationBar *bar)
{
  if (bar.window == nil) return NO; // Initial presentation is reconciled at didShow.
  for (UIBarButtonItem *item in items) {
    UIView *view = item.customView;
    if (view != nil && !view.hidden && view.alpha > 0 &&
        (view.window != bar.window || ![view isDescendantOfView:bar])) return YES;
  }
  return NO;
}

static char RNSSharedToolbarExperimentSkippedRepairRolesKey;

static BOOL RNSShouldSkipSharedToolbarExperimentRepairOnce(
    RNSTabBarController *controller,
    NSArray<UIBarButtonItem *> *items,
    NSString *reason,
    NSString **diagnosticReason)
{
  if (diagnosticReason == NULL) return NO;
  *diagnosticReason = @"detached_custom_view";
  if (controller == nil || items.count == 0 ||
      ![RNSCurrentToolbarMorphExperimentVariant() isEqualToString:@"B"]) {
    return NO;
  }

  NSString *role = nil;
  for (UIBarButtonItem *item in items) {
    NSString *itemRole = RNSRoleForToolbarMorphItem(item);
    if (![itemRole isEqualToString:@"home-search"] &&
        ![itemRole isEqualToString:@"settings-profile"]) {
      *diagnosticReason = @"experiment_b_shared_side_preserved";
      return NO;
    }
    if (role != nil && ![role isEqualToString:itemRole]) {
      *diagnosticReason = @"experiment_b_shared_side_preserved";
      return NO;
    }
    role = itemRole;
  }

  NSMutableSet<NSString *> *skippedRoles =
      objc_getAssociatedObject(controller, &RNSSharedToolbarExperimentSkippedRepairRolesKey);
  if ([skippedRoles containsObject:role]) {
    *diagnosticReason = @"experiment_b_recovery";
    return NO;
  }
  if (![reason isEqualToString:@"tab-transition-completion"]) return NO;
  if (skippedRoles == nil) {
    skippedRoles = [NSMutableSet set];
    objc_setAssociatedObject(
        controller,
        &RNSSharedToolbarExperimentSkippedRepairRolesKey,
        skippedRoles,
        OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }

  [skippedRoles addObject:role];
  *diagnosticReason = @"experiment_b_skip_once";
  return YES;
}

static UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)
{`,
    'attachment',
  );
  patch(
    controller,
    'static BOOL RNSSharedToolbarItemsNeedAttachment(NSArray<UIBarButtonItem *> *items, UINavigationBar *bar)\n{',
    `static char RNSSharedToolbarPendingTabTransitionKey;

static void RNSObserveSharedToolbarTabTransition(
    RNSTabBarController *controller,
    UIViewController *viewController)
{
  id<UIViewControllerTransitionCoordinator> transitionCoordinator =
      controller.transitionCoordinator ?: viewController.transitionCoordinator;
  if (transitionCoordinator == nil ||
      objc_getAssociatedObject(controller, &RNSSharedToolbarPendingTabTransitionKey) == transitionCoordinator) {
    return;
  }

  objc_setAssociatedObject(
      controller,
      &RNSSharedToolbarPendingTabTransitionKey,
      transitionCoordinator,
      OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  __weak RNSTabBarController *weakController = controller;
  __weak id<UIViewControllerTransitionCoordinator> weakTransitionCoordinator = transitionCoordinator;
  [transitionCoordinator animateAlongsideTransition:nil completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
    (void)context;
    RNSTabBarController *strongController = weakController;
    id<UIViewControllerTransitionCoordinator> completedCoordinator = weakTransitionCoordinator;
    if (strongController == nil || completedCoordinator == nil) return;

    if (objc_getAssociatedObject(strongController, &RNSSharedToolbarPendingTabTransitionKey) == completedCoordinator) {
      objc_setAssociatedObject(
          strongController,
          &RNSSharedToolbarPendingTabTransitionKey,
          nil,
          OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }

    UIViewController *selectedViewController = [strongController effectiveSelectedViewController];
    id<UIViewControllerTransitionCoordinator> activeCoordinator =
        strongController.transitionCoordinator ?: selectedViewController.transitionCoordinator;
    if (activeCoordinator != nil && activeCoordinator != completedCoordinator) {
      RNSObserveSharedToolbarTabTransition(strongController, selectedViewController);
      return;
    }

    [strongController synchronizeSharedNavigationBarWithReason:@"tab-transition-completion"];
  }];
}

static BOOL RNSSharedToolbarItemsNeedAttachment(NSArray<UIBarButtonItem *> *items, UINavigationBar *bar)
{`,
    PATCH_MARKERS.sharedToolbarTransitionObserver,
  );
  patch(
    controller,
    '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason\n{',
    `- (void)captureSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController
{
  if (navigationController == nil || navigationController.viewControllers.count != 1 ||
      navigationController.topViewController != viewController) return;
  BOOL isTabSource = NO;
  for (UIViewController *tab in [self installedScreenControllers]) {
    if (RNSFindNestedNavigationController(tab) == navigationController) {
      isTabSource = YES;
      break;
    }
  }
  if (!isTabSource) return; // Never capture the root Stack's placeholders or pushed screens.
  UINavigationItem *item = viewController.navigationItem;
  NSDictionary *materialized = @{@"left": item.leftBarButtonItems ?: @[], @"right": item.rightBarButtonItems ?: @[]};
  objc_setAssociatedObject(item, &RNSSharedToolbarMaterializedItemsKey, materialized, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  // Transfer registration before installation: the hidden source bar must not own these items.
  [item setLeftBarButtonItems:nil animated:NO];
  [item setRightBarButtonItems:nil animated:NO];
}

- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason
{`,
    'capture',
  );
  patch(
    controller,
    '  if (nestedNavigationController != nil) {\n    // The nested stack remains',
    `${SHARED_TOOLBAR_TRANSITION_GUARD}

  if (nestedNavigationController != nil) {
    // The nested stack remains`,
    'transition',
  );
  patch(
    controller,
    '  NSArray<UIBarButtonItem *> *leftItems = sourceNavigationItem.leftBarButtonItems ?: @[];\n  NSArray<UIBarButtonItem *> *rightItems = sourceNavigationItem.rightBarButtonItems ?: @[];',
    `  NSDictionary *materializedItems = objc_getAssociatedObject(sourceNavigationItem, &RNSSharedToolbarMaterializedItemsKey);
  if (materializedItems == nil) {
    return; // Missing source is not a deliberate empty toolbar.
  }
  NSArray<UIBarButtonItem *> *leftItems = materializedItems[@"left"];
  NSArray<UIBarButtonItem *> *rightItems = materializedItems[@"right"];
`,
    'materialized-source',
  );
  patch(
    controller,
    '      !(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual);',
    `      !(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual) &&
      !isTransitionCompletion;`,
    'completion-animation',
  );
  patch(
    controller,
    '  [sharedNavigationController setNavigationBarHidden:NO animated:NO];\n}',
    `  [sharedNavigationController setNavigationBarHidden:NO animated:NO];
  UINavigationBar *bar = sharedNavigationController.navigationBar;
  BOOL canCheckAttachment = bar.window != nil &&
      (isTransitionCompletion || ([self isScreenControllerCurrentlySelected:viewController] &&
       nestedNavigationController.topViewController.viewIfLoaded.window != nil &&
       (!shouldAnimateToolbarItemReplacement ||
        (RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems) &&
         RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)))));
  if (canCheckAttachment) [bar layoutIfNeeded];
  BOOL repairLeft = canCheckAttachment && RNSSharedToolbarItemsNeedAttachment(leftItems, bar);
  BOOL repairRight = canCheckAttachment && RNSSharedToolbarItemsNeedAttachment(rightItems, bar);
  NSString *repairReasonLeft = @"detached_custom_view";
  NSString *repairReasonRight = @"detached_custom_view";
  BOOL skipAttachmentRepairLeft = repairLeft &&
      RNSShouldSkipSharedToolbarExperimentRepairOnce(self, leftItems, reason, &repairReasonLeft);
  BOOL skipAttachmentRepairRight = repairRight &&
      RNSShouldSkipSharedToolbarExperimentRepairOnce(self, rightItems, reason, &repairReasonRight);
  if (repairLeft || repairRight) {
    // Re-register only detached sides after exclusive ownership has been established.
    // This is synchronous lifecycle reconciliation, not a retry or an animated morph.
    if (repairLeft && !skipAttachmentRepairLeft) {
      [sharedNavigationItem setLeftBarButtonItems:nil animated:NO];
      [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];
    }
    if (repairRight && !skipAttachmentRepairRight) {
      [sharedNavigationItem setRightBarButtonItems:nil animated:NO];
      [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];
    }
    if ((repairLeft && !skipAttachmentRepairLeft) ||
        (repairRight && !skipAttachmentRepairRight)) {
      [bar layoutIfNeeded];
    }
  }
}`,
    'reconcile',
  );
  patch(
    config,
    'static void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController)',
    'static void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController, BOOL didMaterialize)',
    'materialization-phase',
  );
  patch(
    config,
    `// ${PATCH_MARKERS.sharedToolbarConfigHidden}\n    RNSSynchronizeSharedTabToolbar(vc, navctr);`,
    `// ${PATCH_MARKERS.sharedToolbarConfigHidden}
    RNSSynchronizeSharedTabToolbar(vc, navctr, NO);`,
    'hidden-phase',
  );
  patch(
    config,
    `// ${PATCH_MARKERS.sharedToolbarConfigVisible}\n  RNSSynchronizeSharedTabToolbar(vc, navctr);`,
    `// ${PATCH_MARKERS.sharedToolbarConfigVisible}
  RNSSynchronizeSharedTabToolbar(vc, navctr, YES);`,
    'visible-phase',
  );
  patch(
    config,
    '  [tabsController synchronizeSharedNavigationBarWithReason:@"header-materialization/resync"];',
    `  if (didMaterialize) {
    [tabsController captureSharedToolbarItemsFromViewController:viewController navigationController:navigationController];
  }
  [tabsController synchronizeSharedNavigationBarWithReason:@"header-materialization/resync"];`,
    'materialization-capture',
  );

  patch(
    stack,
    '#import "RNSScreenStackHeaderConfig.h"',
    `#import "tabs/host/RNSTabBarController.h"
#import "RNSScreenStackHeaderConfig.h"`,
    'did-show-import',
  );
  patch(
    stack,
    '#import "RNSScreenStackHeaderConfig.h"',
    `#import "RNSScreenStackHeaderConfig.h"
${SHARED_TOOLBAR_NAVIGATION_OPERATION_HELPER}

static RNSTabBarController *RNSFindSharedToolbarTabsController(UIViewController *controller)
{
  if ([controller isKindOfClass:[RNSTabBarController class]]) return (RNSTabBarController *)controller;
  for (UIViewController *child in controller.childViewControllers) {
    RNSTabBarController *found = RNSFindSharedToolbarTabsController(child);
    if (found != nil) return found;
  }
  return nil;
}
`,
    'did-show-helper',
  );
  ensureSharedToolbarNavigationOperationHelper(stack);
  patch(
    stack,
    'withConfig:screenView.findHeaderConfig];',
    `withConfig:screenView.findHeaderConfig];
  // ${PATCH_MARKERS.sharedToolbarPopStaging}
  NSArray<UIViewController *> *previousStack =
      objc_getAssociatedObject(navigationController, &RNSSharedToolbarStableNavigationStackKey);
  UIViewController *fromViewController = nil;
  NSString *operation = RNSSharedToolbarNavigationOperation(
      navigationController, previousStack, viewController, &fromViewController);
  RNSTabBarController *tabsController = RNSFindSharedToolbarTabsController(viewController);
  UIViewController *ancestor = navigationController;
  while (ancestor != nil && tabsController == nil) {
    tabsController = RNSFindSharedToolbarTabsController(ancestor);
    ancestor = ancestor.parentViewController;
  }
  NSString *stageResult = @"not_pop";
  if ([operation isEqualToString:@"pop"]) {
    stageResult = tabsController == nil
        ? @"tabs_controller_unavailable"
        : [tabsController stageSharedToolbarItemsForNavigationPopInNavigationController:
              navigationController fromViewController:fromViewController toViewController:viewController];
  }
  // Emporio Rigatti: toolbar pop stage decision complete`,
    PATCH_MARKERS.sharedToolbarPopStaging,
  );
  patch(
    stack,
    '  [_controller.view setNeedsLayout];\n}\n#endif\n\n- (void)markChildUpdated',
    `  [_controller.view setNeedsLayout];
  RNSTabBarController *tabsController = nil;
  UIViewController *ancestor = navigationController;
  while (ancestor != nil && tabsController == nil) {
    tabsController = RNSFindSharedToolbarTabsController(ancestor);
    ancestor = ancestor.parentViewController;
  }
  [tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];
}
#endif

- (void)markChildUpdated`,
    'did-show-reconcile',
  );
  patch(
    stack,
    '[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];',
    `[tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];
  objc_setAssociatedObject(
      navigationController,
      &RNSSharedToolbarStableNavigationStackKey,
      [navigationController.viewControllers copy],
      OBJC_ASSOCIATION_RETAIN_NONATOMIC);`,
    'stable-navigation-stack-snapshot',
  );
}

function patchRNScreens(
  screensRoot = path.dirname(require.resolve('react-native-screens/package.json')),
) {
  if (require(path.join(screensRoot, 'package.json')).version !== '4.30.0') {
    throw new Error('A integração de toolbar foi validada para react-native-screens 4.30.0.');
  }

  patchFile(
    path.join(screensRoot, 'src', 'fabric', 'ScreenNativeComponent.ts'),
    '  nativeBackButtonDismissalEnabled?: boolean | undefined;\n',
    `  nativeBackButtonDismissalEnabled?: boolean | undefined;\n  // ${PATCH_MARKERS.prop}\n  hidesBottomBarWhenPushed?: boolean | undefined;\n`,
    PATCH_MARKERS.prop,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreen.h'),
    '@property (nonatomic) BOOL gestureEnabled;\n',
    `@property (nonatomic) BOOL gestureEnabled;\n// ${PATCH_MARKERS.prop}\n@property (nonatomic) BOOL hidesBottomBarWhenPushed;\n`,
    PATCH_MARKERS.prop,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreen.mm'),
    `- (void)setReplaceAnimation:(RNSScreenReplaceAnimation)replaceAnimation\n{\n  _replaceAnimation = replaceAnimation;\n}\n`,
    `// ${PATCH_MARKERS.setter}\n- (void)setHidesBottomBarWhenPushed:(BOOL)hidesBottomBarWhenPushed\n{\n  _hidesBottomBarWhenPushed = hidesBottomBarWhenPushed;\n  _controller.hidesBottomBarWhenPushed = hidesBottomBarWhenPushed;\n}\n\n- (void)setReplaceAnimation:(RNSScreenReplaceAnimation)replaceAnimation\n{\n  _replaceAnimation = replaceAnimation;\n}\n`,
    PATCH_MARKERS.setter,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreen.mm'),
    '  [self setGestureEnabled:newScreenProps.gestureEnabled];\n',
    `  [self setGestureEnabled:newScreenProps.gestureEnabled];\n\n  // ${PATCH_MARKERS.update}\n  if (newScreenProps.hidesBottomBarWhenPushed != oldScreenProps.hidesBottomBarWhenPushed) {\n    [self setHidesBottomBarWhenPushed:newScreenProps.hidesBottomBarWhenPushed];\n  }\n`,
    PATCH_MARKERS.update,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.h'),
    '- (void)tearDown;\n',
    `- (void)tearDown;\n\n// ${PATCH_MARKERS.sharedToolbarHeader}\n- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason;\n- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;\n- (NSString *)stageSharedToolbarItemsForNavigationPopInNavigationController:(UINavigationController *)navigationController fromViewController:(UIViewController *)fromViewController toViewController:(UIViewController *)toViewController;\n`,
    PATCH_MARKERS.sharedToolbarHeader,
  );
  ensureSharedToolbarPopMethodDeclaration(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.h'),
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '#pragma mark - Signals\n',
    `// ${PATCH_MARKERS.sharedToolbarController}\nstatic UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{\n  for (UIViewController *childViewController in rootViewController.childViewControllers) {\n    if ([childViewController isKindOfClass:[UINavigationController class]]) {\n      return static_cast<UINavigationController *>(childViewController);\n    }\n\n    UINavigationController *nestedNavigationController =\n        RNSFindNestedNavigationController(childViewController);\n    if (nestedNavigationController != nil) {\n      return nestedNavigationController;\n    }\n  }\n\n  return nil;\n}\n\n- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason\n{\n  NSInteger tabIndex = [[self installedScreenControllers] indexOfObject:viewController];\n  if (![viewController isKindOfClass:[RNSTabsScreenViewController class]]) {\n    return;\n  }\n\n  UIViewController *tabsScreenViewController = self.parentViewController;\n  UINavigationController *sharedNavigationController = tabsScreenViewController.navigationController;\n  if (sharedNavigationController == nil ||\n      sharedNavigationController.topViewController != tabsScreenViewController) {\n    return;\n  }\n\n  UINavigationController *nestedNavigationController =\n      RNSFindNestedNavigationController(viewController);\n  BOOL isTabRoot = nestedNavigationController == nil || nestedNavigationController.viewControllers.count <= 1;\n\n  if (!isTabRoot) {\n    [sharedNavigationController setNavigationBarHidden:YES animated:NO];\n    [nestedNavigationController setNavigationBarHidden:NO animated:NO];\n    return;\n  }\n\n  if (nestedNavigationController != nil) {\n    // The nested stack remains the source of the native items, but its root bar must not\n    // compete with the single shared bar owned by the (tabs) screen.\n    [nestedNavigationController setNavigationBarHidden:YES animated:NO];\n  }\n\n  UINavigationItem *sharedNavigationItem = sharedNavigationController.topViewController.navigationItem;\n  UINavigationItem *sourceNavigationItem = nestedNavigationController.topViewController.navigationItem;\n  NSArray<UIBarButtonItem *> *leftItems = sourceNavigationItem.leftBarButtonItems ?: @[];\n  NSArray<UIBarButtonItem *> *rightItems = sourceNavigationItem.rightBarButtonItems ?: @[];\n\n  if (![sharedNavigationItem.leftBarButtonItems isEqualToArray:leftItems]) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:YES];\n  }\n  if (![sharedNavigationItem.rightBarButtonItems isEqualToArray:rightItems]) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:YES];\n  }\n\n  // Items are installed before the shared bar is revealed or the tab controller changes\n  // its visible child, so UIKit can animate the same UINavigationBar transition.\n  [sharedNavigationController setNavigationBarHidden:NO animated:NO];\n}\n\n- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason\n{\n  UIViewController *selectedViewController = [self effectiveSelectedViewController];\n  if (selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:selectedViewController reason:reason];\n  }\n}\n\n#pragma mark - Signals\n`,
    PATCH_MARKERS.sharedToolbarController,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    `- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason
{
  UIViewController *selectedViewController = [self effectiveSelectedViewController];
  if (selectedViewController != nil) {
    [self prepareSharedNavigationBarForViewController:selectedViewController reason:reason];
  }
}

#pragma mark - Signals`,
    `static NSArray<UIBarButtonItem *> *RNSSharedToolbarItemsByRemovingInstances(
    NSArray<UIBarButtonItem *> *items,
    NSArray<UIBarButtonItem *> *itemsToRemove)
{
  NSMutableArray<UIBarButtonItem *> *remainingItems = [NSMutableArray arrayWithCapacity:items.count];
  for (UIBarButtonItem *item in items) {
    BOOL shouldRemove = NO;
    for (UIBarButtonItem *candidate in itemsToRemove) {
      if (item == candidate) {
        shouldRemove = YES;
        break;
      }
    }
    if (!shouldRemove) [remainingItems addObject:item];
  }
  return [remainingItems copy];
}

// ${PATCH_MARKERS.sharedToolbarPopMethod}
- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason
{
  UIViewController *selectedViewController = [self effectiveSelectedViewController];
  if (selectedViewController != nil) {
    [self prepareSharedNavigationBarForViewController:selectedViewController reason:reason];
  }
}

- (NSString *)stageSharedToolbarItemsForNavigationPopInNavigationController:(UINavigationController *)navigationController
                                                         fromViewController:(UIViewController *)fromViewController
                                                           toViewController:(UIViewController *)toViewController
{
  if (navigationController == nil || fromViewController == nil || toViewController == nil) {
    return @"navigation_context_unavailable";
  }

  UIViewController *tabsScreenViewController = self.parentViewController;
  UINavigationController *sharedNavigationController = tabsScreenViewController.navigationController;
  UIViewController *selectedTabViewController = [self effectiveSelectedViewController];
  if (selectedTabViewController == nil) return @"shared_navigation_context_unavailable";
  NSInteger selectedTabIndex = [[self installedScreenControllers] indexOfObject:selectedTabViewController];
  UINavigationController *selectedNestedNavigationController =
      RNSFindNestedNavigationController(selectedTabViewController);
  if (sharedNavigationController == nil ||
      selectedNestedNavigationController == nil ||
      sharedNavigationController.topViewController != tabsScreenViewController) {
    return @"shared_navigation_context_unavailable";
  }

  UINavigationItem *sourceNavigationItem = nil;
  UINavigationItem *destinationNavigationItem = toViewController.navigationItem;
  NSString *successResult = nil;
  BOOL isHomeSharedRootPop = navigationController == sharedNavigationController &&
      toViewController == tabsScreenViewController && selectedTabIndex == 0 &&
      selectedNestedNavigationController.viewControllers.count == 1 &&
      selectedNestedNavigationController.topViewController ==
          selectedNestedNavigationController.viewControllers.firstObject;
  BOOL isSettingsNestedRootPop = navigationController == selectedNestedNavigationController &&
      toViewController == selectedNestedNavigationController.viewControllers.firstObject &&
      selectedNestedNavigationController.viewControllers.count == 1 && selectedTabIndex == 3;

  if (isHomeSharedRootPop) {
    sourceNavigationItem = selectedNestedNavigationController.topViewController.navigationItem;
    successResult = @"staged_home_root";
  } else if (isSettingsNestedRootPop) {
    if (!sharedNavigationController.navigationBarHidden) return @"settings_shared_bar_visible";
    sourceNavigationItem = toViewController.navigationItem;
    successResult = @"staged_settings_root";
  } else {
    return @"not_target_root_pop";
  }

  NSDictionary *materializedItems =
      objc_getAssociatedObject(sourceNavigationItem, &RNSSharedToolbarMaterializedItemsKey);
  if (materializedItems == nil) return @"root_items_unavailable";

  NSArray<UIBarButtonItem *> *leftItems = materializedItems[@"left"] ?: @[];
  NSArray<UIBarButtonItem *> *rightItems = materializedItems[@"right"] ?: @[];
  if (leftItems.count == 0 && rightItems.count == 0) return @"root_items_empty";

  UINavigationItem *sharedNavigationItem = tabsScreenViewController.navigationItem;
  if (isSettingsNestedRootPop) {
    NSArray<UIBarButtonItem *> *remainingSharedLeftItems =
        RNSSharedToolbarItemsByRemovingInstances(sharedNavigationItem.leftBarButtonItems ?: @[], leftItems);
    NSArray<UIBarButtonItem *> *remainingSharedRightItems =
        RNSSharedToolbarItemsByRemovingInstances(sharedNavigationItem.rightBarButtonItems ?: @[], rightItems);
    if (!RNSHomeToolbarItemArraysHaveSameInstances(
            sharedNavigationItem.leftBarButtonItems ?: @[], remainingSharedLeftItems)) {
      [sharedNavigationItem setLeftBarButtonItems:remainingSharedLeftItems.count > 0
          ? remainingSharedLeftItems : nil animated:NO];
    }
    if (!RNSHomeToolbarItemArraysHaveSameInstances(
            sharedNavigationItem.rightBarButtonItems ?: @[], remainingSharedRightItems)) {
      [sharedNavigationItem setRightBarButtonItems:remainingSharedRightItems.count > 0
          ? remainingSharedRightItems : nil animated:NO];
    }
  }

  if (!RNSHomeToolbarItemArraysHaveSameInstances(
          destinationNavigationItem.leftBarButtonItems ?: @[], leftItems)) {
    [destinationNavigationItem setLeftBarButtonItems:leftItems.count > 0 ? leftItems : nil animated:NO];
  }
  if (!RNSHomeToolbarItemArraysHaveSameInstances(
          destinationNavigationItem.rightBarButtonItems ?: @[], rightItems)) {
    [destinationNavigationItem setRightBarButtonItems:rightItems.count > 0 ? rightItems : nil animated:NO];
  }

  return successResult;
}

#pragma mark - Signals`,
    PATCH_MARKERS.sharedToolbarPopMethod,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    'static UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{',
    `// ${PATCH_MARKERS.homeToolbarSemanticComparison}\nstatic NSString *RNSFindHomeToolbarSemanticIdentifier(UIView *rootView)\n{\n  if (rootView == nil) {\n    return nil;\n  }\n  NSString *identifier = rootView.accessibilityIdentifier;\n  if ([identifier hasPrefix:@"home-toolbar-item:"]) {\n    return identifier;\n  }\n  for (UIView *subview in rootView.subviews) {\n    NSString *match = RNSFindHomeToolbarSemanticIdentifier(subview);\n    if (match != nil) {\n      return match;\n    }\n  }\n  return nil;\n}\n\nstatic NSString *RNSHomeToolbarItemSemanticSignature(UIBarButtonItem *item)\n{\n  NSString *identifier = RNSFindHomeToolbarSemanticIdentifier(item.customView);\n  if (identifier == nil || item.customView == nil) {\n    return nil;\n  }\n  return [NSString stringWithFormat:@"%@|class=%@|title=%@|label=%@|hint=%@|action=%@|enabled=%d|style=%ld|width=%.2f|viewClass=%@|viewSize=%@|hidden=%d|alpha=%.3f",\n      identifier,\n      NSStringFromClass(item.class),\n      item.title ?: @"nil",\n      item.accessibilityLabel ?: @"nil",\n      item.accessibilityHint ?: @"nil",\n      item.action == NULL ? @"nil" : NSStringFromSelector(item.action),\n      item.isEnabled,\n      (long)item.style,\n      item.width,\n      NSStringFromClass(item.customView.class),\n      NSStringFromCGSize(item.customView.bounds.size),\n      item.customView.hidden,\n      item.customView.alpha];\n}\n\nstatic BOOL RNSHomeToolbarItemArraysAreSemanticallyEqual(NSArray<UIBarButtonItem *> *first,\n                                                          NSArray<UIBarButtonItem *> *second)\n{\n  if (first.count != second.count) {\n    return NO;\n  }\n  for (NSUInteger index = 0; index < first.count; index++) {\n    NSString *firstSignature = RNSHomeToolbarItemSemanticSignature(first[index]);\n    NSString *secondSignature = RNSHomeToolbarItemSemanticSignature(second[index]);\n    if (firstSignature == nil || ![firstSignature isEqualToString:secondSignature]) {\n      return NO;\n    }\n  }\n  return YES;\n}\n\nstatic BOOL RNSHomeToolbarItemSetsAreSemanticallyEqual(NSArray<UIBarButtonItem *> *sourceLeft,\n                                                        NSArray<UIBarButtonItem *> *sourceRight,\n                                                        NSArray<UIBarButtonItem *> *sharedLeft,\n                                                        NSArray<UIBarButtonItem *> *sharedRight)\n{\n  return RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceLeft, sharedLeft) &&\n      RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceRight, sharedRight);\n}\n\nstatic BOOL RNSHomeToolbarItemArraysHaveSameInstances(NSArray<UIBarButtonItem *> *first,\n                                                       NSArray<UIBarButtonItem *> *second)\n{\n  if (first.count != second.count) {\n    return NO;\n  }\n  for (NSUInteger index = 0; index < first.count; index++) {\n    if (first[index] != second[index]) {\n      return NO;\n    }\n  }\n  return YES;\n}\n\nstatic UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{`,
    PATCH_MARKERS.homeToolbarSemanticComparison,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    `  if (![sharedNavigationItem.leftBarButtonItems isEqualToArray:leftItems]) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:YES];\n  }\n  if (![sharedNavigationItem.rightBarButtonItems isEqualToArray:rightItems]) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:YES];\n  }`,
    `  // ${PATCH_MARKERS.homeToolbarReplacementPolicy}\n  NSArray<UIBarButtonItem *> *sharedLeftItems = sharedNavigationItem.leftBarButtonItems ?: @[];\n  NSArray<UIBarButtonItem *> *sharedRightItems = sharedNavigationItem.rightBarButtonItems ?: @[];\n  BOOL isSelectedHomeTab = tabIndex == 0 && [self isScreenControllerCurrentlySelected:viewController];\n  BOOL isHeaderMaterializationResync = [reason isEqualToString:@"header-materialization/resync"];\n  BOOL areCompleteToolbarSetsSemanticallyEqual = RNSHomeToolbarItemSetsAreSemanticallyEqual(\n      leftItems, rightItems, sharedLeftItems, sharedRightItems);\n  BOOL shouldAnimateToolbarItemReplacement =\n      !(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual);\n\n  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement];\n  }\n  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement];\n  }`,
    PATCH_MARKERS.homeToolbarReplacementPolicy,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  [super setSelectedIndex:selectedIndex];\n',
    `// ${PATCH_MARKERS.sharedToolbarIndex}\n- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  NSArray<RNSTabsScreenViewController *> *installedControllers = [self installedScreenControllers];\n  if (selectedIndex < installedControllers.count) {\n    [self prepareSharedNavigationBarForViewController:installedControllers[selectedIndex] reason:@"tab-selection-index"];\n  }\n  [super setSelectedIndex:selectedIndex];\n`,
    PATCH_MARKERS.sharedToolbarIndex,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '- (void)setSelectedViewController:(__kindof UIViewController *)selectedViewController\n{\n  [super setSelectedViewController:selectedViewController];\n',
    `// ${PATCH_MARKERS.sharedToolbarViewController}\n- (void)setSelectedViewController:(__kindof UIViewController *)selectedViewController\n{\n  if (selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:selectedViewController reason:@"programmatic-selection"];\n  }\n  [super setSelectedViewController:selectedViewController];\n`,
    PATCH_MARKERS.sharedToolbarViewController,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '- (void)setSelectedTab:(UITab *)selectedTab API_AVAILABLE(ios(18.0))\n{\n  [super setSelectedTab:selectedTab];\n',
    `// ${PATCH_MARKERS.sharedToolbarTabSelection}\n- (void)setSelectedTab:(UITab *)selectedTab API_AVAILABLE(ios(18.0))\n{\n  if (selectedTab.viewController != nil) {\n    [self prepareSharedNavigationBarForViewController:selectedTab.viewController reason:@"programmatic-selection"];\n  }\n  [super setSelectedTab:selectedTab];\n`,
    PATCH_MARKERS.sharedToolbarTabSelection,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '  _isHandlingExplicitSelectionUpdate = YES;\n  return YES;\n}\n\n- (void)tabBarController:(UITabBarController *)tabBarController\n',
    `  // ${PATCH_MARKERS.sharedToolbarShouldSelect}\n  [self prepareSharedNavigationBarForViewController:viewController reason:@"tab-selection-shouldSelect"];\n  _isHandlingExplicitSelectionUpdate = YES;\n  return YES;\n}\n\n- (void)tabBarController:(UITabBarController *)tabBarController\n`,
    PATCH_MARKERS.sharedToolbarShouldSelect,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '  [self updateOrientationIfNeeded];\n}\n\n/**\n * Update UIKit model and associated navigation state.\n',
    `  [self updateOrientationIfNeeded];\n  // ${PATCH_MARKERS.sharedToolbarFlush}\n  [self synchronizeSharedNavigationBarWithReason:@"container-resync"];\n}\n\n/**\n * Update UIKit model and associated navigation state.\n`,
    PATCH_MARKERS.sharedToolbarFlush,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '#import "UINavigationBar+RNSUtility.h"\n',
    `#import "UINavigationBar+RNSUtility.h"\n#import "tabs/host/RNSTabBarController.h"\n// ${PATCH_MARKERS.sharedToolbarConfigImport}\n`,
    PATCH_MARKERS.sharedToolbarConfigImport,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    'namespace react = facebook::react;\n',
    `namespace react = facebook::react;\n\n// ${PATCH_MARKERS.sharedToolbarConfig}\nstatic RNSTabBarController *RNSFindTabBarControllerInViewController(UIViewController *rootViewController)\n{\n  if ([rootViewController isKindOfClass:[RNSTabBarController class]]) {\n    return static_cast<RNSTabBarController *>(rootViewController);\n  }\n\n  for (UIViewController *childViewController in rootViewController.childViewControllers) {\n    RNSTabBarController *tabsController =\n        RNSFindTabBarControllerInViewController(childViewController);\n    if (tabsController != nil) {\n      return tabsController;\n    }\n  }\n\n  return nil;\n}\n\nstatic void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController)\n{\n  RNSTabBarController *tabsController = nil;\n  if ([navigationController.tabBarController isKindOfClass:[RNSTabBarController class]]) {\n    tabsController = static_cast<RNSTabBarController *>(navigationController.tabBarController);\n  }\n\n  if (tabsController == nil) {\n    UIViewController *parentViewController = navigationController;\n    while (parentViewController != nil && tabsController == nil) {\n      tabsController = RNSFindTabBarControllerInViewController(parentViewController);\n      parentViewController = parentViewController.parentViewController;\n    }\n  }\n\n  if (tabsController == nil) {\n    tabsController = RNSFindTabBarControllerInViewController(viewController);\n  }\n\n  [tabsController synchronizeSharedNavigationBarWithReason:@"header-materialization/resync"];\n}\n`,
    PATCH_MARKERS.sharedToolbarConfigHelpers,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '    [navctr setNavigationBarHidden:YES animated:animated];\n    return;\n',
    `    [navctr setNavigationBarHidden:YES animated:animated];\n    // ${PATCH_MARKERS.sharedToolbarConfigHidden}\n    RNSSynchronizeSharedTabToolbar(vc, navctr);\n    return;\n`,
    PATCH_MARKERS.sharedToolbarConfigHidden,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '    [self setAnimatedConfig:vc withConfig:config];\n  }\n}\n\n- (void)configureBackItem:',
    `    [self setAnimatedConfig:vc withConfig:config];\n  }\n\n  // ${PATCH_MARKERS.sharedToolbarConfigVisible}\n  RNSSynchronizeSharedTabToolbar(vc, navctr);\n}\n\n- (void)configureBackItem:`,
    PATCH_MARKERS.sharedToolbarConfigVisible,
  );
  patchSharedToolbarOwnership(screensRoot);
}

function withRNScreensHideBottomBarWhenPushed(config) {
  return withDangerousMod(config, [
    'ios',
    (configWithMod) => {
      patchRNScreens();
      return configWithMod;
    },
  ]);
}

const withRNScreensHideBottomBarWhenPushedPlugin = createRunOncePlugin(
  withRNScreensHideBottomBarWhenPushed,
  'with-rnscreens-hide-bottom-bar-when-pushed',
  '1.3.0',
);

Object.defineProperty(withRNScreensHideBottomBarWhenPushedPlugin, '__patchRNScreensForTests', {
  value: patchRNScreens,
});

module.exports = withRNScreensHideBottomBarWhenPushedPlugin;
