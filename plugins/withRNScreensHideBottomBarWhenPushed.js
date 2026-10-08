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
  sharedToolbarUpdate: 'Emporio Rigatti: shared tab toolbar update',
  sharedToolbarShouldSelect: 'Emporio Rigatti: shared tab toolbar should select',
  sharedToolbarFlush: 'Emporio Rigatti: shared tab toolbar flush',
  sharedToolbarConfigImport: 'Emporio Rigatti: shared tab toolbar config import',
  sharedToolbarConfig: 'Emporio Rigatti: shared tab toolbar config helpers',
  sharedToolbarConfigHelpers: 'Emporio Rigatti: shared tab toolbar config helpers',
  sharedToolbarConfigHidden: 'Emporio Rigatti: shared tab toolbar config hidden',
  sharedToolbarConfigVisible: 'Emporio Rigatti: shared tab toolbar config visible',
  homeToolbarSemanticComparison: 'Emporio Rigatti: Home toolbar semantic comparison',
  homeToolbarReplacementPolicy: 'Emporio Rigatti: Home toolbar replacement policy',
};

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

function patchSharedToolbarOwnership(screensRoot) {
  const header = path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.h');
  const controller = path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm');
  const config = path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm');
  const stack = path.join(screensRoot, 'ios', 'RNSScreenStack.mm');
  const patch = (file, needle, replacement, name) =>
    patchFile(file, needle, replacement, `Emporio Rigatti: shared toolbar ownership ${name}`);

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

static UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)
{`,
    'attachment',
  );
  patch(
    controller,
    '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason\n{',
    `- (void)captureSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController
{
  if (navigationController == nil || navigationController.viewControllers.count != 1 ||
      navigationController.topViewController != viewController) return;
  BOOL isTabSource = NO;
  for (UIViewController *tab in self.viewControllers) {
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
    `  BOOL isTransitionCompletion = [reason isEqualToString:@"navigation-did-show"];
  if (!isTransitionCompletion && (sharedNavigationController.transitionCoordinator != nil ||
                                 nestedNavigationController.transitionCoordinator != nil)) {
    return; // UIKit owns the in-flight morph; didShow reconciles the actual destination.
  }

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
      (isTransitionCompletion || (self.selectedViewController == viewController &&
       nestedNavigationController.topViewController.viewIfLoaded.window != nil &&
       (!shouldAnimateToolbarItemReplacement ||
        (RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems) &&
         RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)))));
  if (canCheckAttachment) [bar layoutIfNeeded];
  BOOL repairLeft = canCheckAttachment && RNSSharedToolbarItemsNeedAttachment(leftItems, bar);
  BOOL repairRight = canCheckAttachment && RNSSharedToolbarItemsNeedAttachment(rightItems, bar);
  if (repairLeft || repairRight) {
    // Re-register only detached sides after exclusive ownership has been established.
    // This is synchronous lifecycle reconciliation, not a retry or an animated morph.
    if (repairLeft) {
      [sharedNavigationItem setLeftBarButtonItems:nil animated:NO];
      [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];
    }
    if (repairRight) {
      [sharedNavigationItem setRightBarButtonItems:nil animated:NO];
      [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];
    }
    [bar layoutIfNeeded];
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
}

function patchRNScreens() {
  const screensRoot = path.dirname(require.resolve('react-native-screens/package.json'));

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
    `- (void)tearDown;\n\n// ${PATCH_MARKERS.sharedToolbarHeader}\n- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason;\n- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;\n`,
    PATCH_MARKERS.sharedToolbarHeader,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '#pragma mark - Signals\n',
    `// ${PATCH_MARKERS.sharedToolbarController}\nstatic UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{\n  for (UIViewController *childViewController in rootViewController.childViewControllers) {\n    if ([childViewController isKindOfClass:[UINavigationController class]]) {\n      return static_cast<UINavigationController *>(childViewController);\n    }\n\n    UINavigationController *nestedNavigationController =\n        RNSFindNestedNavigationController(childViewController);\n    if (nestedNavigationController != nil) {\n      return nestedNavigationController;\n    }\n  }\n\n  return nil;\n}\n\n- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason\n{\n  NSInteger tabIndex = [self.viewControllers indexOfObject:viewController];\n  if (![viewController isKindOfClass:[RNSTabsScreenViewController class]]) {\n    return;\n  }\n\n  UIViewController *tabsScreenViewController = self.parentViewController;\n  UINavigationController *sharedNavigationController = tabsScreenViewController.navigationController;\n  if (sharedNavigationController == nil ||\n      sharedNavigationController.topViewController != tabsScreenViewController) {\n    return;\n  }\n\n  UINavigationController *nestedNavigationController =\n      RNSFindNestedNavigationController(viewController);\n  BOOL isTabRoot = nestedNavigationController == nil || nestedNavigationController.viewControllers.count <= 1;\n\n  if (!isTabRoot) {\n    [sharedNavigationController setNavigationBarHidden:YES animated:NO];\n    [nestedNavigationController setNavigationBarHidden:NO animated:NO];\n    return;\n  }\n\n  if (nestedNavigationController != nil) {\n    // The nested stack remains the source of the native items, but its root bar must not\n    // compete with the single shared bar owned by the (tabs) screen.\n    [nestedNavigationController setNavigationBarHidden:YES animated:NO];\n  }\n\n  UINavigationItem *sharedNavigationItem = sharedNavigationController.topViewController.navigationItem;\n  UINavigationItem *sourceNavigationItem = nestedNavigationController.topViewController.navigationItem;\n  NSArray<UIBarButtonItem *> *leftItems = sourceNavigationItem.leftBarButtonItems ?: @[];\n  NSArray<UIBarButtonItem *> *rightItems = sourceNavigationItem.rightBarButtonItems ?: @[];\n\n  if (![sharedNavigationItem.leftBarButtonItems isEqualToArray:leftItems]) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:YES];\n  }\n  if (![sharedNavigationItem.rightBarButtonItems isEqualToArray:rightItems]) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:YES];\n  }\n\n  // Items are installed before the shared bar is revealed or the tab controller changes\n  // its visible child, so UIKit can animate the same UINavigationBar transition.\n  [sharedNavigationController setNavigationBarHidden:NO animated:NO];\n}\n\n- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason\n{\n  if (self.selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:self.selectedViewController reason:reason];\n  }\n}\n\n#pragma mark - Signals\n`,
    PATCH_MARKERS.sharedToolbarController,
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
    `  // ${PATCH_MARKERS.homeToolbarReplacementPolicy}\n  NSArray<UIBarButtonItem *> *sharedLeftItems = sharedNavigationItem.leftBarButtonItems ?: @[];\n  NSArray<UIBarButtonItem *> *sharedRightItems = sharedNavigationItem.rightBarButtonItems ?: @[];\n  BOOL isSelectedHomeTab = tabIndex == 0 && self.selectedIndex == (NSUInteger)tabIndex;\n  BOOL isHeaderMaterializationResync = [reason isEqualToString:@"header-materialization/resync"];\n  BOOL areCompleteToolbarSetsSemanticallyEqual = RNSHomeToolbarItemSetsAreSemanticallyEqual(\n      leftItems, rightItems, sharedLeftItems, sharedRightItems);\n  BOOL shouldAnimateToolbarItemReplacement =\n      !(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual);\n\n  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement];\n  }\n  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement];\n  }`,
    PATCH_MARKERS.homeToolbarReplacementPolicy,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  [super setSelectedIndex:selectedIndex];\n',
    `// ${PATCH_MARKERS.sharedToolbarIndex}\n- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  if (selectedIndex < self.viewControllers.count) {\n    [self prepareSharedNavigationBarForViewController:self.viewControllers[selectedIndex] reason:@"tab-selection-index"];\n  }\n  [super setSelectedIndex:selectedIndex];\n`,
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
    '  [self setSelectedViewController:nextSelectedViewController];\n  return YES;\n',
    `  // ${PATCH_MARKERS.sharedToolbarUpdate}\n  [self prepareSharedNavigationBarForViewController:nextSelectedViewController reason:@"tab-selection-commit"];\n  [self setSelectedViewController:nextSelectedViewController];\n  return YES;\n`,
    PATCH_MARKERS.sharedToolbarUpdate,
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

module.exports = createRunOncePlugin(
  withRNScreensHideBottomBarWhenPushed,
  'with-rnscreens-hide-bottom-bar-when-pushed',
  '1.1.0',
);
