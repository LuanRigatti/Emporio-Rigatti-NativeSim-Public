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
};

function patchFile(filePath, needle, replacement, marker) {
  const contents = fs.readFileSync(filePath, 'utf8');

  if (contents.includes(marker)) return;

  if (!contents.includes(needle)) {
    throw new Error(`Não foi possível aplicar a integração de tab bar em ${filePath}.`);
  }

  fs.writeFileSync(filePath, contents.replace(needle, replacement));
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
    `- (void)tearDown;\n\n// ${PATCH_MARKERS.sharedToolbarHeader}\n- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController;\n- (void)synchronizeSharedNavigationBar;\n`,
    PATCH_MARKERS.sharedToolbarHeader,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '#pragma mark - Signals\n',
    `// ${PATCH_MARKERS.sharedToolbarController}\nstatic UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{\n  for (UIViewController *childViewController in rootViewController.childViewControllers) {\n    if ([childViewController isKindOfClass:[UINavigationController class]]) {\n      return static_cast<UINavigationController *>(childViewController);\n    }\n\n    UINavigationController *nestedNavigationController =\n        RNSFindNestedNavigationController(childViewController);\n    if (nestedNavigationController != nil) {\n      return nestedNavigationController;\n    }\n  }\n\n  return nil;\n}\n\n- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController\n{\n  if (![viewController isKindOfClass:[RNSTabsScreenViewController class]]) {\n    return;\n  }\n\n  UIViewController *tabsScreenViewController = self.parentViewController;\n  UINavigationController *sharedNavigationController = tabsScreenViewController.navigationController;\n  if (sharedNavigationController == nil ||\n      sharedNavigationController.topViewController != tabsScreenViewController) {\n    return;\n  }\n\n  UINavigationController *nestedNavigationController =\n      RNSFindNestedNavigationController(viewController);\n  BOOL isTabRoot = nestedNavigationController == nil || nestedNavigationController.viewControllers.count <= 1;\n\n  if (!isTabRoot) {\n    [sharedNavigationController setNavigationBarHidden:YES animated:NO];\n    [nestedNavigationController setNavigationBarHidden:NO animated:NO];\n    return;\n  }\n\n  if (nestedNavigationController != nil) {\n    // The nested stack remains the source of the native items, but its root bar must not\n    // compete with the single shared bar owned by the (tabs) screen.\n    [nestedNavigationController setNavigationBarHidden:YES animated:NO];\n  }\n\n  UINavigationItem *sharedNavigationItem = sharedNavigationController.topViewController.navigationItem;\n  UINavigationItem *sourceNavigationItem = nestedNavigationController.topViewController.navigationItem;\n  NSArray<UIBarButtonItem *> *leftItems = sourceNavigationItem.leftBarButtonItems ?: @[];\n  NSArray<UIBarButtonItem *> *rightItems = sourceNavigationItem.rightBarButtonItems ?: @[];\n\n  if (![sharedNavigationItem.leftBarButtonItems isEqualToArray:leftItems]) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:YES];\n  }\n  if (![sharedNavigationItem.rightBarButtonItems isEqualToArray:rightItems]) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:YES];\n  }\n\n  // Items are installed before the shared bar is revealed or the tab controller changes\n  // its visible child, so UIKit can animate the same UINavigationBar transition.\n  [sharedNavigationController setNavigationBarHidden:NO animated:NO];\n}\n\n- (void)synchronizeSharedNavigationBar\n{\n  if (self.selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:self.selectedViewController];\n  }\n}\n\n#pragma mark - Signals\n`,
    PATCH_MARKERS.sharedToolbarController,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  [super setSelectedIndex:selectedIndex];\n',
    `// ${PATCH_MARKERS.sharedToolbarIndex}\n- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  if (selectedIndex < self.viewControllers.count) {\n    [self prepareSharedNavigationBarForViewController:self.viewControllers[selectedIndex]];\n  }\n  [super setSelectedIndex:selectedIndex];\n`,
    PATCH_MARKERS.sharedToolbarIndex,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '- (void)setSelectedViewController:(__kindof UIViewController *)selectedViewController\n{\n  [super setSelectedViewController:selectedViewController];\n',
    `// ${PATCH_MARKERS.sharedToolbarViewController}\n- (void)setSelectedViewController:(__kindof UIViewController *)selectedViewController\n{\n  if (selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:selectedViewController];\n  }\n  [super setSelectedViewController:selectedViewController];\n`,
    PATCH_MARKERS.sharedToolbarViewController,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '  [self setSelectedViewController:nextSelectedViewController];\n  return YES;\n',
    `  // ${PATCH_MARKERS.sharedToolbarUpdate}\n  [self prepareSharedNavigationBarForViewController:nextSelectedViewController];\n  [self setSelectedViewController:nextSelectedViewController];\n  return YES;\n`,
    PATCH_MARKERS.sharedToolbarUpdate,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '  _isHandlingExplicitSelectionUpdate = YES;\n  return YES;\n}\n\n- (void)tabBarController:(UITabBarController *)tabBarController\n',
    `  // ${PATCH_MARKERS.sharedToolbarShouldSelect}\n  [self prepareSharedNavigationBarForViewController:viewController];\n  _isHandlingExplicitSelectionUpdate = YES;\n  return YES;\n}\n\n- (void)tabBarController:(UITabBarController *)tabBarController\n`,
    PATCH_MARKERS.sharedToolbarShouldSelect,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
    '  [self updateOrientationIfNeeded];\n}\n\n/**\n * Update UIKit model and associated navigation state.\n',
    `  [self updateOrientationIfNeeded];\n  // ${PATCH_MARKERS.sharedToolbarFlush}\n  [self synchronizeSharedNavigationBar];\n}\n\n/**\n * Update UIKit model and associated navigation state.\n`,
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
    `namespace react = facebook::react;\n\n// ${PATCH_MARKERS.sharedToolbarConfig}\nstatic RNSTabBarController *RNSFindTabBarControllerInViewController(UIViewController *rootViewController)\n{\n  if ([rootViewController isKindOfClass:[RNSTabBarController class]]) {\n    return static_cast<RNSTabBarController *>(rootViewController);\n  }\n\n  for (UIViewController *childViewController in rootViewController.childViewControllers) {\n    RNSTabBarController *tabsController =\n        RNSFindTabBarControllerInViewController(childViewController);\n    if (tabsController != nil) {\n      return tabsController;\n    }\n  }\n\n  return nil;\n}\n\nstatic void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController)\n{\n  RNSTabBarController *tabsController = nil;\n  if ([navigationController.tabBarController isKindOfClass:[RNSTabBarController class]]) {\n    tabsController = static_cast<RNSTabBarController *>(navigationController.tabBarController);\n  }\n\n  if (tabsController == nil) {\n    UIViewController *parentViewController = navigationController;\n    while (parentViewController != nil && tabsController == nil) {\n      tabsController = RNSFindTabBarControllerInViewController(parentViewController);\n      parentViewController = parentViewController.parentViewController;\n    }\n  }\n\n  if (tabsController == nil) {\n    tabsController = RNSFindTabBarControllerInViewController(viewController);\n  }\n\n  [tabsController synchronizeSharedNavigationBar];\n}\n`,
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
