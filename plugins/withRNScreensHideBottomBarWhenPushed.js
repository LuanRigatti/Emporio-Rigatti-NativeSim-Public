const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PATCH_MARKERS = {
  nestedRootBarSuppression: 'Emporio Rigatti: suppress nested root bar before reveal',
  nestedRootBarHelper: 'Emporio Rigatti: nested root bar ownership helpers',
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
  toolbarLifecycle: 'Emporio Rigatti: shared toolbar lifecycle v3',
  prePopPreparation: 'Emporio Rigatti: shared toolbar pre-pop preparation',
  interactivePopPreparation: 'Emporio Rigatti: shared toolbar interactive pop preparation',
  customSwipePreparation: 'Emporio Rigatti: shared toolbar custom swipe preparation',
  normalPopCall: 'Emporio Rigatti: prepare shared toolbar before normal pop',
  gestureBeginCall: 'Emporio Rigatti: prepare shared toolbar before accepted pop gesture',
  customSwipeBeginCall: 'Emporio Rigatti: prepare shared toolbar before custom swipe pop',
  screenTransitionCall: 'Emporio Rigatti: prepare shared toolbar before screen transition pop',
  refreshBarButtonConfiguration: 'Emporio Rigatti: refresh retained bar button configuration',
  mergeSharedToolbarItems: 'Emporio Rigatti: retain safe shared toolbar item identity',
  prePopHeaderPreservation:
    'Emporio Rigatti: preserve prepared toolbar during destination willShow',
  prePopHeaderReset: 'Emporio Rigatti: preserve pre-pop toolbar item arrays',
  prePopHeaderLeftSubview: 'Emporio Rigatti: do not duplicate prepared left toolbar item',
  prePopHeaderRightSubview: 'Emporio Rigatti: do not duplicate prepared right toolbar item',
  prePopHeaderAssignments: 'Emporio Rigatti: keep prepared destination toolbar configuration',
};

const TOOLBAR_AUDIT_HELPERS = `#import <TargetConditionals.h>
static NSString *RNSHomeToolbarItemSemanticSignature(UIBarButtonItem *item);

static NSString *RNSAuditSemanticIdentifier(UIView *view)
{
  if (view == nil) return nil;
  NSString *identifier = view.accessibilityIdentifier;
  if ([identifier hasPrefix:@"home-toolbar-item:"] ||
      [identifier isEqualToString:@"home-search-toolbar"]) return identifier;
  for (UIView *subview in view.subviews) {
    NSString *nested = RNSAuditSemanticIdentifier(subview);
    if (nested != nil) return nested;
  }
  return nil;
}

static NSString *RNSAuditToolbarItemRole(UIBarButtonItem *item)
{
  NSString *identifier = RNSAuditSemanticIdentifier(item.customView);
  if ([identifier containsString:@"search"] || [identifier isEqualToString:@"home-search-toolbar"]) return @"home-search";
  if ([item.accessibilityLabel isEqualToString:@"Busca"] || [item.title isEqualToString:@"Busca"]) return @"home-search";
  if ([item.accessibilityLabel isEqualToString:@"Selecionar período"]) return @"finance-period-combined";
  if ([item.accessibilityLabel isEqualToString:@"Selecionar mês"]) return @"finance-month";
  if ([item.accessibilityLabel isEqualToString:@"Selecionar ano"]) return @"finance-year";
  if (item.menu != nil) return @"menu";
  return item.customView == nil ? @"native" : @"custom";
}

static NSString *RNSAuditToolbarRoles(NSArray<UIBarButtonItem *> *items)
{
  NSMutableArray<NSString *> *roles = [NSMutableArray arrayWithCapacity:items.count];
  for (UIBarButtonItem *item in items) [roles addObject:RNSAuditToolbarItemRole(item)];
  return [NSString stringWithFormat:@"%lu:[%@]", (unsigned long)items.count, [roles componentsJoinedByString:@","]];
}

static NSString *RNSAuditNavigationBarRoles(UINavigationBar *bar)
{
  UINavigationItem *item = bar.topItem;
  if (item == nil) return @"none";
  return [NSString stringWithFormat:@"L=%@ R=%@",
      RNSAuditToolbarRoles(item.leftBarButtonItems ?: @[]),
      RNSAuditToolbarRoles(item.rightBarButtonItems ?: @[])];
}

static NSString *RNSAuditToolbarItemDetails(NSArray<UIBarButtonItem *> *items)
{
  NSMutableArray<NSString *> *details = [NSMutableArray arrayWithCapacity:items.count];
  for (UIBarButtonItem *item in items) {
    UIView *view = item.customView;
    UIView *superview = view.superview;
    NSString *viewClass = view == nil ? @"-" : NSStringFromClass(view.class);
    NSString *superviewClass = superview == nil ? @"-" : NSStringFromClass(superview.class);
    NSString *bounds = view == nil ? @"-" : NSStringFromCGRect(view.bounds);
    [details addObject:[NSString stringWithFormat:@"%@ item=%p view=%p/%@ super=%p/%@ window=%p bounds=%@",
        RNSAuditToolbarItemRole(item), item, view, viewClass, superview, superviewClass,
        view.window, bounds]];
  }
  return [details componentsJoinedByString:@";"];
}

static BOOL RNSViewControllerContainsToolbarTabsController(UIViewController *viewController,
                                                            RNSTabBarController *tabsController)
{
  if (viewController == nil || tabsController == nil) return NO;
  if (viewController == tabsController) return YES;
  for (UIViewController *child in viewController.childViewControllers) {
    if (RNSViewControllerContainsToolbarTabsController(child, tabsController)) return YES;
  }
  return NO;
}

static BOOL RNSAuditToolbarItemViewIsReady(UIBarButtonItem *item, UINavigationBar *bar)
{
  UIView *view = item.customView;
  return view != nil && bar.window != nil && view.window == bar.window &&
      [view isDescendantOfView:bar] && view.bounds.size.width > 0 && view.bounds.size.height > 0;
}

static id RNSFindAccessibleToolbarElement(UIView *view, NSString *identifier)
{
  if (view == nil) return nil;
  if ([view.accessibilityIdentifier isEqualToString:identifier]) return view;
  if ([view respondsToSelector:@selector(accessibilityElementCount)] &&
      [view respondsToSelector:@selector(accessibilityElementAtIndex:)]) {
    id<UIAccessibilityContainer> container = (id<UIAccessibilityContainer>)view;
    NSInteger count = [container accessibilityElementCount];
    for (NSInteger index = 0; index < count; index++) {
      id element = [container accessibilityElementAtIndex:index];
      if ([element conformsToProtocol:@protocol(UIAccessibilityIdentification)] &&
          [[(id<UIAccessibilityIdentification>)element accessibilityIdentifier] isEqualToString:identifier]) {
        return element;
      }
      if ([element isKindOfClass:UIView.class]) {
        id nested = RNSFindAccessibleToolbarElement((UIView *)element, identifier);
        if (nested != nil) return nested;
      }
    }
  }
  for (UIView *subview in view.subviews) {
    id nested = RNSFindAccessibleToolbarElement(subview, identifier);
    if (nested != nil) return nested;
  }
  return nil;
}

static BOOL RNSAccessibleToolbarElementIsVisibleInWindow(id element, UINavigationBar *bar)
{
  if (element == nil || bar == nil || bar.window == nil) return NO;
  UIWindow *window = bar.window;
  CGRect elementFrame = CGRectNull;
  if ([element isKindOfClass:UIView.class]) {
    UIView *view = (UIView *)element;
    if (view.window != window || ![view isDescendantOfView:bar] ||
        view.bounds.size.width <= 0 || view.bounds.size.height <= 0) return NO;
    elementFrame = [view convertRect:view.bounds toCoordinateSpace:window.screen.coordinateSpace];
  } else if ([element isKindOfClass:UIAccessibilityElement.class]) {
    elementFrame = ((UIAccessibilityElement *)element).accessibilityFrame;
  }
  id<UICoordinateSpace> screenSpace = window.screen.coordinateSpace;
  CGRect windowFrame = [window convertRect:window.bounds toCoordinateSpace:screenSpace];
  CGRect barFrame = [bar convertRect:bar.bounds toCoordinateSpace:screenSpace];
  return !CGRectIsNull(elementFrame) && !CGRectIsEmpty(elementFrame) &&
      CGRectIntersectsRect(elementFrame, windowFrame) && CGRectIntersectsRect(elementFrame, barFrame);
}

static UIBarButtonItem *RNSFindReadyToolbarItemForRole(NSArray<UIBarButtonItem *> *items,
                                                       UINavigationBar *bar,
                                                       NSString *role,
                                                       id *actualElementOut)
{
  for (UIBarButtonItem *item in items) {
    if (![RNSAuditToolbarItemRole(item) isEqualToString:role] ||
        !RNSAuditToolbarItemViewIsReady(item, bar)) continue;
    if ([role isEqualToString:@"home-search"]) {
      id actualElement = RNSFindAccessibleToolbarElement(item.customView, @"home-search-toolbar");
      if (!RNSAccessibleToolbarElementIsVisibleInWindow(actualElement, bar)) continue;
      if (actualElementOut != NULL) *actualElementOut = actualElement;
    }
    return item;
  }
  return nil;
}

static NSString *RNSMaybePublishHomeToolbarReadiness(UINavigationController *sharedNavigationController,
                                                     RNSTabBarController *tabsController)
{
  NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
  NSString *composition = [defaults stringForKey:@"com.emporio.rigatti.homeToolbar.expectedComposition"];
  UIViewController *tabsScreen = tabsController.parentViewController;
  UINavigationBar *bar = sharedNavigationController.navigationBar;
  if (composition == nil || [defaults boolForKey:@"com.emporio.rigatti.homeToolbar.isReady"] ||
      ![defaults boolForKey:@"com.emporio.rigatti.homeToolbar.rootDidShow"] ||
      tabsScreen == nil || sharedNavigationController.topViewController != tabsScreen ||
      sharedNavigationController.transitionCoordinator != nil || bar.window == nil ||
      sharedNavigationController.navigationBarHidden) return nil;
  [bar layoutIfNeeded];
  UINavigationItem *topItem = bar.topItem;
  if (topItem == nil) return nil;
  NSArray<UIBarButtonItem *> *leftItems = topItem.leftBarButtonItems ?: @[];
  NSArray<UIBarButtonItem *> *rightItems = topItem.rightBarButtonItems ?: @[];
  id searchElement = nil;
  BOOL hasExpectedLeading = leftItems.count == 0;
  BOOL hasRequiredSearch = ![composition isEqualToString:@"wholesale"] ||
      RNSFindReadyToolbarItemForRole(rightItems, bar, @"home-search", &searchElement) != nil;
  if (!hasExpectedLeading || !hasRequiredSearch || bar.hidden || bar.alpha <= 0) return nil;

  [defaults setBool:YES forKey:@"com.emporio.rigatti.homeToolbar.isReady"];
#if TARGET_OS_SIMULATOR
  UIBarButtonItem *searchItem = [composition isEqualToString:@"wholesale"]
      ? RNSFindReadyToolbarItemForRole(rightItems, bar, @"home-search", &searchElement) : nil;
  NSString *readinessTrace = [NSString stringWithFormat:
      @"nav=%p bar=%p root=%p roles={%@} items={L:%@ R:%@} search-element=%p view=%p super=%p window=%p bounds=%@",
      sharedNavigationController, bar, tabsScreen, RNSAuditNavigationBarRoles(bar),
      RNSAuditToolbarItemDetails(topItem.leftBarButtonItems ?: @[]),
      RNSAuditToolbarItemDetails(topItem.rightBarButtonItems ?: @[]), searchElement,
      searchItem.customView, searchItem.customView.superview, searchItem.customView.window,
      searchItem == nil ? @"-" : NSStringFromCGRect(searchItem.customView.bounds)];
  [defaults setObject:readinessTrace forKey:@"com.emporio.rigatti.homeToolbar.readinessTrace"];
  NSLog(@"[TOOLBAR-TRACE] readiness.ready composition=%@ %@", composition, readinessTrace);
#endif
  [[NSNotificationCenter defaultCenter] postNotificationName:@"com.emporio.rigatti.homeToolbar.ready"
                                                      object:nil
                                                    userInfo:@{@"composition": composition}];
  return composition;
}

static BOOL RNSSharedToolbarArraysAreSemanticallyEqual(NSArray<UIBarButtonItem *> *first,
                                                       NSArray<UIBarButtonItem *> *second)
{
  if (first.count != second.count) return NO;
  for (NSUInteger index = 0; index < first.count; index++) {
    UIBarButtonItem *left = first[index];
    UIBarButtonItem *right = second[index];
    NSString *leftHome = RNSHomeToolbarItemSemanticSignature(left);
    NSString *rightHome = RNSHomeToolbarItemSemanticSignature(right);
    if (leftHome != nil || rightHome != nil) {
      if (leftHome == nil || ![leftHome isEqualToString:rightHome]) return NO;
      continue;
    }
    NSString *leftRole = RNSAuditToolbarItemRole(left);
    NSString *rightRole = RNSAuditToolbarItemRole(right);
    if ([leftRole isEqualToString:@"menu"] || [rightRole isEqualToString:@"menu"]) return NO;
    if (![leftRole isEqualToString:rightRole] ||
        ![left.title isEqualToString:right.title] ||
        ![left.accessibilityLabel isEqualToString:right.accessibilityLabel] ||
        (left.menu != nil) != (right.menu != nil) ||
        [leftRole isEqualToString:@"custom"] || [leftRole isEqualToString:@"native"]) return NO;
  }
  return YES;
}

static BOOL RNSSharedToolbarSnapshotsAreSemanticallyEqual(NSDictionary *first, NSDictionary *second)
{
  if (first == nil || second == nil) return NO;
  return RNSSharedToolbarArraysAreSemanticallyEqual(first[@"left"] ?: @[], second[@"left"] ?: @[]) &&
      RNSSharedToolbarArraysAreSemanticallyEqual(first[@"right"] ?: @[], second[@"right"] ?: @[]);
}

// ${PATCH_MARKERS.mergeSharedToolbarItems}
static BOOL RNSNullableStringsEqual(NSString *first, NSString *second)
{
  return first == second || (first != nil && second != nil && [first isEqualToString:second]);
}

static NSArray<UIBarButtonItem *> *RNSRetainSafeSharedToolbarItemInstances(
    NSArray<UIBarButtonItem *> *sharedItems,
    NSArray<UIBarButtonItem *> *cachedItems,
    NSArray<UIBarButtonItem *> *destinationItems)
{
  NSMutableArray<UIBarButtonItem *> *result = [NSMutableArray arrayWithCapacity:destinationItems.count];
  for (NSUInteger index = 0; index < destinationItems.count; index++) {
    UIBarButtonItem *destinationItem = destinationItems[index];
    UIBarButtonItem *retainedItem = nil;
    NSArray<NSArray<UIBarButtonItem *> *> *candidateSets = @[sharedItems ?: @[], cachedItems ?: @[]];
    for (NSArray<UIBarButtonItem *> *candidateSet in candidateSets) {
      if (candidateSet.count != destinationItems.count) continue;
      UIBarButtonItem *candidate = candidateSet[index];
      if (candidate == destinationItem) {
        retainedItem = candidate;
        break;
      }

      BOOL sameCustomView = candidate.customView != nil &&
          candidate.customView == destinationItem.customView &&
          RNSNullableStringsEqual(candidate.title, destinationItem.title) &&
          RNSNullableStringsEqual(candidate.accessibilityLabel, destinationItem.accessibilityLabel) &&
          RNSNullableStringsEqual(candidate.accessibilityHint, destinationItem.accessibilityHint) &&
          candidate.target == destinationItem.target && candidate.action == destinationItem.action &&
          candidate.isEnabled == destinationItem.isEnabled && candidate.width == destinationItem.width;
      if (sameCustomView) {
        retainedItem = candidate;
        break;
      }

      BOOL hasStableLabel = candidate.accessibilityLabel.length > 0 || candidate.title.length > 0 ||
          candidate.accessibilityIdentifier.length > 0;
      BOOL sameRefreshableAction = hasStableLabel &&
          [candidate isKindOfClass:RNSBarButtonItem.class] &&
          [destinationItem isKindOfClass:RNSBarButtonItem.class] &&
          candidate.customView == nil && destinationItem.customView == nil &&
          [RNSAuditToolbarItemRole(candidate) isEqualToString:RNSAuditToolbarItemRole(destinationItem)] &&
          RNSNullableStringsEqual(candidate.title, destinationItem.title) &&
          RNSNullableStringsEqual(candidate.accessibilityLabel, destinationItem.accessibilityLabel) &&
          RNSNullableStringsEqual(candidate.accessibilityIdentifier, destinationItem.accessibilityIdentifier);
      if (sameRefreshableAction &&
          [(RNSBarButtonItem *)candidate rns_refreshConfigurationFromItem:(RNSBarButtonItem *)destinationItem]) {
        retainedItem = candidate;
        break;
      }
    }
    [result addObject:retainedItem ?: destinationItem];
  }
  return result;
}`;

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
    controller,
    '#import "RNSTabBarController.h"',
    '#import "RNSTabBarController.h"\n#import "RNSBarButtonItem.h"',
    'bar-button-refresh-import',
  );
  patch(
    path.join(screensRoot, 'ios', 'RNSBarButtonItem.h'),
    '\n@end',
    '\n- (BOOL)rns_refreshConfigurationFromItem:(RNSBarButtonItem *)source;\n@end',
    'bar-button-refresh-declaration',
  );
  patch(
    path.join(screensRoot, 'ios', 'RNSBarButtonItem.mm'),
    '  RNSBarButtonItemAction _itemAction;\n',
    '  RNSBarButtonItemAction _itemAction;\n  BOOL _rnsCanRefreshConfiguration;\n',
    'bar-button-refresh-safety-state',
  );
  patch(
    path.join(screensRoot, 'ios', 'RNSBarButtonItem.mm'),
    '  [[self class] resolveImageFromConfig:dict',
    `  _rnsCanRefreshConfiguration = dict[@"sfSymbolName"] == nil && dict[@"xcassetName"] == nil &&
      dict[@"imageSource"] == nil && dict[@"templateSource"] == nil && dict[@"badge"] == nil;
  [[self class] resolveImageFromConfig:dict`,
    'bar-button-refresh-safety-initialization',
  );
  patch(
    path.join(screensRoot, 'ios', 'RNSBarButtonItem.mm'),
    '+ (void)resolveImageFromConfig:(NSDictionary *)dict',
    `- (BOOL)rns_refreshConfigurationFromItem:(RNSBarButtonItem *)source
{
  if (source == nil || source == self || self.customView != nil || source.customView != nil ||
      !_rnsCanRefreshConfiguration || !source->_rnsCanRefreshConfiguration) return NO;

  self.title = source.title;
  self.image = source.image;
  self.tintColor = source.tintColor;
  self.width = source.width;
  self.style = source.style;
  self.enabled = source.enabled;
  self.accessibilityLabel = source.accessibilityLabel;
  self.accessibilityHint = source.accessibilityHint;
  self.accessibilityIdentifier = source.accessibilityIdentifier;
  self.possibleTitles = source.possibleTitles;
  self.tag = source.tag;
  for (NSNumber *state in @[@(UIControlStateNormal), @(UIControlStateHighlighted),
                            @(UIControlStateDisabled), @(UIControlStateSelected)]) {
    [self setTitleTextAttributes:[source titleTextAttributesForState:state.unsignedIntegerValue]
                        forState:state.unsignedIntegerValue];
  }

#if !TARGET_OS_TV || __TV_OS_VERSION_MAX_ALLOWED >= 170000
  if (@available(iOS 13.0, tvOS 13.0, *)) self.menu = source.menu;
  if (@available(iOS 15.0, tvOS 17.0, *)) {
    self.changesSelectionAsPrimaryAction = source.changesSelectionAsPrimaryAction;
  }
#endif

#if !TARGET_OS_TV
  if (@available(iOS 13.0, *)) self.selected = source.selected;
#endif

#if RNS_IPHONE_OS_VERSION_AVAILABLE(26_0)
  if (@available(iOS 26.0, *)) {
    self.hidesSharedBackground = source.hidesSharedBackground;
    self.sharesBackground = source.sharesBackground;
    self.identifier = source.identifier;
  }
#endif

  _buttonId = [source->_buttonId copy];
  _itemAction = [source->_itemAction copy];
  if (_buttonId != nil && _itemAction != nil) {
    self.target = self;
    self.action = @selector(handleBarButtonItemPress:);
  } else if (source.target == source && source.action == @selector(handleBarButtonItemPress:)) {
    self.target = self;
    self.action = source.action;
  } else {
    self.target = source.target;
    self.action = source.action;
  }
  return YES;
}

+ (void)resolveImageFromConfig:(NSDictionary *)dict`,
    'bar-button-refresh-implementation',
  );

  patch(
    header,
    '- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;',
    `// ${PATCH_MARKERS.toolbarLifecycle}
- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason;
- (void)logToolbarAuditEvent:(NSString *)event reason:(NSString *)reason navigationController:(UINavigationController *)navigationController fromController:(UIViewController *)fromController toController:(UIViewController *)toController;
- (void)captureSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController;
- (void)commitStagedSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController;
- (BOOL)prepareSharedNavigationBarForPopToViewController:(UIViewController *)viewController inNavigationController:(UINavigationController *)navigationController;
- (BOOL)consumeSharedToolbarPrePopPreparationForViewController:(UIViewController *)viewController;`,
    'capture-header',
  );
  patch(
    controller,
    'static UINavigationController *RNSFindNestedNavigationController(UIViewController *rootViewController)\n{',
    `${TOOLBAR_AUDIT_HELPERS}
// Retained configuration is not a second UIKit navigation-item owner.
static char RNSSharedToolbarMaterializedItemsKey;
static char RNSSharedToolbarStagedItemsKey;
static char RNSSharedToolbarPrePopPreparedKey;

static BOOL RNSSharedToolbarItemsNeedAttachment(NSArray<UIBarButtonItem *> *items, UINavigationBar *bar)
{
  if (bar.window == nil) return NO;
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
    `- (void)logToolbarAuditEvent:(NSString *)event reason:(NSString *)reason navigationController:(UINavigationController *)navigationController fromController:(UIViewController *)fromController toController:(UIViewController *)toController
{
#if TARGET_OS_SIMULATOR
  NSInteger fromIndex = fromController == nil ? NSNotFound : [navigationController.viewControllers indexOfObject:fromController];
  NSInteger toIndex = toController == nil ? NSNotFound : [navigationController.viewControllers indexOfObject:toController];
  NSString *direction = fromIndex == NSNotFound || toIndex == NSNotFound || fromIndex == toIndex
      ? @"transition" : (toIndex < fromIndex ? @"pop" : @"push");
  UINavigationBar *bar = navigationController.navigationBar;
  UINavigationController *sharedNavigationController = self.parentViewController.navigationController;
  UINavigationBar *sharedBar = sharedNavigationController.navigationBar;
  UIViewController *selectedTab = self.selectedViewController;
  NSString *selectedTabKey = nil;
  if ([selectedTab isKindOfClass:RNSTabsScreenViewController.class]) {
    RNSTabsScreenViewController *selectedTabScreen = static_cast<RNSTabsScreenViewController *>(selectedTab);
    selectedTabKey = [selectedTabScreen getScreenKeyOrNull];
  }
  UINavigationController *selectedTabNavigationController = RNSFindNestedNavigationController(selectedTab);
  BOOL barAttached = bar.window != nil;
  BOOL visibleSharedBar = bar == sharedBar && barAttached && !navigationController.navigationBarHidden &&
      !bar.hidden && bar.alpha > 0;
  BOOL shouldTraceItemViews = [event isEqualToString:@"navigation.transition.begin"] ||
      [event isEqualToString:@"navigation.willShow"] || [event isEqualToString:@"navigation.didShow"] ||
      [event isEqualToString:@"pre-pop.prepare.begin"] || [event isEqualToString:@"pre-pop.prepare.done"] ||
      [event isEqualToString:@"interactive-pop.prepare"] ||
      [event isEqualToString:@"navigation.destination-prepared"];
  NSString *fromItemRoles = fromController == nil ? @"-" : [NSString stringWithFormat:@"L=%@ R=%@",
      RNSAuditToolbarRoles(fromController.navigationItem.leftBarButtonItems ?: @[]),
      RNSAuditToolbarRoles(fromController.navigationItem.rightBarButtonItems ?: @[])];
  NSString *toItemRoles = toController == nil ? @"-" : [NSString stringWithFormat:@"L=%@ R=%@",
      RNSAuditToolbarRoles(toController.navigationItem.leftBarButtonItems ?: @[]),
      RNSAuditToolbarRoles(toController.navigationItem.rightBarButtonItems ?: @[])];
  NSString *itemDetails = shouldTraceItemViews
      ? [NSString stringWithFormat:@"from={L:%@ R:%@} to={L:%@ R:%@} bar={L:%@ R:%@} shared={L:%@ R:%@}",
          fromController == nil ? @"-" : RNSAuditToolbarItemDetails(fromController.navigationItem.leftBarButtonItems ?: @[]),
          fromController == nil ? @"-" : RNSAuditToolbarItemDetails(fromController.navigationItem.rightBarButtonItems ?: @[]),
          toController == nil ? @"-" : RNSAuditToolbarItemDetails(toController.navigationItem.leftBarButtonItems ?: @[]),
          toController == nil ? @"-" : RNSAuditToolbarItemDetails(toController.navigationItem.rightBarButtonItems ?: @[]),
          RNSAuditToolbarItemDetails(bar.topItem.leftBarButtonItems ?: @[]),
          RNSAuditToolbarItemDetails(bar.topItem.rightBarButtonItems ?: @[]),
          RNSAuditToolbarItemDetails(sharedBar.topItem.leftBarButtonItems ?: @[]),
          RNSAuditToolbarItemDetails(sharedBar.topItem.rightBarButtonItems ?: @[])]
      : @"-";
  NSLog(@"[TOOLBAR-TRACE] %@ %@ %@ nav=%p/%@ bar=%p topItem=%p window=%p attached=%d hidden=%d/%d alpha=%.2f from=%p:%@[%@] to=%p:%@[%@] tabs=%p selected=%@/%@ tabNav=%p shared=%p/%p visible-shared-bar=%d roles={%@} itemViews={%@}",
      event ?: @"event", reason ?: @"-", direction,
      navigationController, NSStringFromClass(navigationController.class), bar, bar.topItem, bar.window, barAttached,
      navigationController.navigationBarHidden, bar.hidden, bar.alpha,
      fromController, fromController == nil ? @"nil" : NSStringFromClass(fromController.class), fromItemRoles,
      toController, toController == nil ? @"nil" : NSStringFromClass(toController.class), toItemRoles,
      self, selectedTabKey ?: @"-",
      selectedTab == nil ? @"nil" : NSStringFromClass(selectedTab.class), selectedTabNavigationController,
      sharedNavigationController, sharedBar, visibleSharedBar,
      RNSAuditNavigationBarRoles(bar), itemDetails);
#endif
}

- (void)captureSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController
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
  NSDictionary *cached = objc_getAssociatedObject(item, &RNSSharedToolbarMaterializedItemsKey);
  if (navigationController.transitionCoordinator != nil ||
      self.parentViewController.navigationController.transitionCoordinator != nil) {
    objc_setAssociatedObject(item, &RNSSharedToolbarStagedItemsKey, materialized, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    return; // Do not detach or reparent live items while UIKit is transitioning.
  }
  if (cached == nil || !RNSSharedToolbarSnapshotsAreSemanticallyEqual(cached, materialized)) {
    objc_setAssociatedObject(item, &RNSSharedToolbarMaterializedItemsKey, materialized, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  objc_setAssociatedObject(item, &RNSSharedToolbarStagedItemsKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  [item setLeftBarButtonItems:nil animated:NO];
  [item setRightBarButtonItems:nil animated:NO];
}

- (void)commitStagedSharedToolbarItemsFromViewController:(UIViewController *)viewController navigationController:(UINavigationController *)navigationController
{
  if (navigationController == nil || navigationController.viewControllers.count == 0) return;
  UIViewController *rootController = navigationController.viewControllers.firstObject;
  if (RNSViewControllerContainsToolbarTabsController(viewController, self)) {
    UINavigationController *selectedNestedNavigationController = RNSFindNestedNavigationController(self.selectedViewController);
    rootController = selectedNestedNavigationController.viewControllers.firstObject;
  }
  if (rootController == nil) return;
  UINavigationItem *rootItem = rootController.navigationItem;
  objc_setAssociatedObject(rootItem, &RNSSharedToolbarPrePopPreparedKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  NSDictionary *staged = objc_getAssociatedObject(rootItem, &RNSSharedToolbarStagedItemsKey);
  if (staged == nil) return;

  NSDictionary *cached = objc_getAssociatedObject(rootItem, &RNSSharedToolbarMaterializedItemsKey);
  NSArray<UIBarButtonItem *> *cachedLeft = cached[@"left"] ?: @[];
  NSArray<UIBarButtonItem *> *cachedRight = cached[@"right"] ?: @[];
  if (cached == nil || !RNSSharedToolbarSnapshotsAreSemanticallyEqual(cached, staged)) {
    objc_setAssociatedObject(rootItem, &RNSSharedToolbarMaterializedItemsKey, staged, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  objc_setAssociatedObject(rootItem, &RNSSharedToolbarStagedItemsKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  NSArray<UIBarButtonItem *> *stagedLeft = staged[@"left"] ?: @[];
  NSArray<UIBarButtonItem *> *stagedRight = staged[@"right"] ?: @[];
  NSArray<UIBarButtonItem *> *currentLeft = rootItem.leftBarButtonItems ?: @[];
  NSArray<UIBarButtonItem *> *currentRight = rootItem.rightBarButtonItems ?: @[];
  if (RNSHomeToolbarItemArraysHaveSameInstances(currentLeft, stagedLeft) ||
      RNSHomeToolbarItemArraysHaveSameInstances(currentLeft, cachedLeft)) {
    [rootItem setLeftBarButtonItems:nil animated:NO];
  }
  if (RNSHomeToolbarItemArraysHaveSameInstances(currentRight, stagedRight) ||
      RNSHomeToolbarItemArraysHaveSameInstances(currentRight, cachedRight)) {
    [rootItem setRightBarButtonItems:nil animated:NO];
  }
  (void)viewController;
}

- (BOOL)consumeSharedToolbarPrePopPreparationForViewController:(UIViewController *)viewController
{
  if (viewController == nil) return NO;
  UINavigationItem *item = viewController.navigationItem;
  BOOL isPrepared = [objc_getAssociatedObject(item, &RNSSharedToolbarPrePopPreparedKey) boolValue];
  objc_setAssociatedObject(item, &RNSSharedToolbarPrePopPreparedKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  return isPrepared;
}

- (BOOL)prepareSharedNavigationBarForPopToViewController:(UIViewController *)viewController inNavigationController:(UINavigationController *)navigationController
{
  if (navigationController == nil || viewController == nil) return NO;
  UIViewController *rootController = navigationController.viewControllers.firstObject;
  id<UIViewControllerTransitionCoordinator> nestedCoordinator = navigationController.transitionCoordinator;
  UIViewController *transitionSource = [nestedCoordinator viewControllerForKey:UITransitionContextFromViewControllerKey];
  BOOL isNestedRootPop = viewController == rootController &&
      (navigationController.viewControllers.count > 1 ||
       (transitionSource != nil && transitionSource != viewController));
  BOOL isSharedTabsDestination = navigationController == self.parentViewController.navigationController &&
      RNSViewControllerContainsToolbarTabsController(viewController, self);
  if (!isNestedRootPop && !isSharedTabsDestination) return NO;

  UINavigationController *selectedNestedNavigationController = RNSFindNestedNavigationController(self.selectedViewController);
  if (isNestedRootPop && selectedNestedNavigationController != navigationController) return NO;
  if (isSharedTabsDestination) {
    if (selectedNestedNavigationController.viewControllers.count == 0) return NO;
    rootController = selectedNestedNavigationController.viewControllers.firstObject;
  }
  if (rootController == nil) return NO;

  UINavigationItem *rootItem = rootController.navigationItem;
  NSDictionary *staged = objc_getAssociatedObject(rootItem, &RNSSharedToolbarStagedItemsKey);
  NSDictionary *cached = objc_getAssociatedObject(rootItem, &RNSSharedToolbarMaterializedItemsKey);
  UINavigationItem *destinationItem = viewController.navigationItem;
  UINavigationController *sharedNavigationController = self.parentViewController.navigationController;
  UIViewController *sharedRootController = sharedNavigationController.topViewController;
  if (sharedNavigationController == nil || sharedRootController != self.parentViewController) return NO;
  UINavigationItem *sharedNavigationItem = sharedRootController.navigationItem;
  NSArray<UIBarButtonItem *> *beforeLeft = destinationItem.leftBarButtonItems ?: @[];
  NSArray<UIBarButtonItem *> *beforeRight = destinationItem.rightBarButtonItems ?: @[];
  NSArray<UIBarButtonItem *> *sharedBeforeLeft = sharedNavigationItem.leftBarButtonItems ?: @[];
  NSArray<UIBarButtonItem *> *sharedBeforeRight = sharedNavigationItem.rightBarButtonItems ?: @[];
  NSDictionary *snapshot = staged;
  NSString *snapshotSource = staged == nil ? @"cached-root-toolbar" : @"staged-destination-materialization";
  if (snapshot == nil && (beforeLeft.count > 0 || beforeRight.count > 0)) {
    snapshot = @{@"left": beforeLeft, @"right": beforeRight};
    snapshotSource = @"live-destination-materialization";
  }
  if (snapshot == nil) snapshot = cached;
  if (snapshot == nil) return NO;

  NSArray<UIBarButtonItem *> *snapshotLeft = snapshot[@"left"] ?: @[];
  NSArray<UIBarButtonItem *> *snapshotRight = snapshot[@"right"] ?: @[];
  NSArray<UIBarButtonItem *> *cachedLeft = cached[@"left"] ?: @[];
  NSArray<UIBarButtonItem *> *cachedRight = cached[@"right"] ?: @[];
  NSArray<UIBarButtonItem *> *leftItems = RNSRetainSafeSharedToolbarItemInstances(
      sharedBeforeLeft, cachedLeft, snapshotLeft);
  NSArray<UIBarButtonItem *> *rightItems = RNSRetainSafeSharedToolbarItemInstances(
      sharedBeforeRight, cachedRight, snapshotRight);
  NSDictionary *preparedSnapshot = @{ @"left": leftItems, @"right": rightItems };
  // Make the latest staged/live configuration reusable, but keep any safe A-owned
  // item instances selected above so UIKit sees a stable destination identity.
  objc_setAssociatedObject(rootItem, &RNSSharedToolbarMaterializedItemsKey, preparedSnapshot, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (staged != nil) {
    objc_setAssociatedObject(rootItem, &RNSSharedToolbarStagedItemsKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  [self logToolbarAuditEvent:@"toolbar.roles.before" reason:@"cached-destination" navigationController:navigationController fromController:navigationController.topViewController toController:viewController];
  if (!RNSHomeToolbarItemArraysHaveSameInstances(rootItem.leftBarButtonItems ?: @[], leftItems)) {
    [rootItem setLeftBarButtonItems:leftItems animated:NO];
  }
  if (!RNSHomeToolbarItemArraysHaveSameInstances(rootItem.rightBarButtonItems ?: @[], rightItems)) {
    [rootItem setRightBarButtonItems:rightItems animated:NO];
  }
  if (destinationItem != rootItem && !RNSHomeToolbarItemArraysHaveSameInstances(beforeLeft, leftItems)) {
    [destinationItem setLeftBarButtonItems:leftItems animated:NO];
  }
  if (destinationItem != rootItem && !RNSHomeToolbarItemArraysHaveSameInstances(beforeRight, rightItems)) {
    [destinationItem setRightBarButtonItems:rightItems animated:NO];
  }
  if (sharedNavigationItem != rootItem && sharedNavigationItem != destinationItem &&
      !RNSHomeToolbarItemArraysHaveSameInstances(sharedBeforeLeft, leftItems)) {
    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];
  }
  if (sharedNavigationItem != rootItem && sharedNavigationItem != destinationItem &&
      !RNSHomeToolbarItemArraysHaveSameInstances(sharedBeforeRight, rightItems)) {
    [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];
  }
  [viewController.view setNeedsLayout];
  [viewController.view layoutIfNeeded];
  [sharedNavigationController.navigationBar setNeedsLayout];
  [sharedNavigationController.navigationBar layoutIfNeeded];
  objc_setAssociatedObject(destinationItem, &RNSSharedToolbarPrePopPreparedKey, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  [self logToolbarAuditEvent:@"navigation.destination-prepared" reason:snapshotSource navigationController:navigationController fromController:navigationController.topViewController toController:viewController];
  [self logToolbarAuditEvent:@"toolbar.roles.after" reason:@"cached-destination" navigationController:navigationController fromController:navigationController.topViewController toController:viewController];
  return YES;
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
    return; // The willShow preflight handles destinations; ordinary resync waits for didShow.
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
    `  UINavigationBar *bar = sharedNavigationController.navigationBar;
  if (bar.window != nil) {
    [bar layoutIfNeeded];
    BOOL attachLeft = RNSSharedToolbarItemsNeedAttachment(leftItems, bar);
    BOOL attachRight = RNSSharedToolbarItemsNeedAttachment(rightItems, bar);
    if (attachLeft || attachRight) {
      if (attachLeft) {
        [sharedNavigationItem setLeftBarButtonItems:nil animated:NO];
        [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];
      }
      if (attachRight) {
        [sharedNavigationItem setRightBarButtonItems:nil animated:NO];
        [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];
      }
      [bar layoutIfNeeded];
    }
  }

  BOOL sharedItemsAttached = bar.window != nil &&
      !RNSSharedToolbarItemsNeedAttachment(leftItems, bar) &&
      !RNSSharedToolbarItemsNeedAttachment(rightItems, bar);
  if (sharedItemsAttached && nestedNavigationController != nil) {
    UINavigationItem *rootItem = nestedNavigationController.viewControllers.firstObject.navigationItem;
    if (RNSHomeToolbarItemArraysHaveSameInstances(rootItem.leftBarButtonItems ?: @[], leftItems)) {
      [rootItem setLeftBarButtonItems:nil animated:NO];
    }
    if (RNSHomeToolbarItemArraysHaveSameInstances(rootItem.rightBarButtonItems ?: @[], rightItems)) {
      [rootItem setRightBarButtonItems:nil animated:NO];
    }
  }
  [sharedNavigationController setNavigationBarHidden:NO animated:NO];
  if (bar.window != nil) [bar layoutIfNeeded];
}`,
    'reconcile',
  );
  patch(
    controller,
    '- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason\n{\n  if (self.selectedViewController != nil) {\n    [self prepareSharedNavigationBarForViewController:self.selectedViewController reason:reason];\n  }\n}',
    `// ${PATCH_MARKERS.toolbarLifecycle}
- (void)synchronizeSharedNavigationBarWithReason:(NSString *)reason
{
  if (self.selectedViewController != nil) {
    [self prepareSharedNavigationBarForViewController:self.selectedViewController reason:reason];
  }
  UINavigationController *sharedNavigationController = self.parentViewController.navigationController;
  RNSMaybePublishHomeToolbarReadiness(sharedNavigationController, self);
}

- (void)viewDidLayoutSubviews
{
  [super viewDidLayoutSubviews];
  UINavigationController *sharedNavigationController = self.parentViewController.navigationController;
  RNSMaybePublishHomeToolbarReadiness(sharedNavigationController, self);
}`,
    'lifecycle-readiness',
  );
  patch(
    config,
    'static void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController)',
    `// ${PATCH_MARKERS.toolbarLifecycle}
static void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController, BOOL didMaterialize)`,
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
    `// ${PATCH_MARKERS.toolbarLifecycle}
  if (didMaterialize) {
    [tabsController captureSharedToolbarItemsFromViewController:viewController navigationController:navigationController];
  }
  [tabsController synchronizeSharedNavigationBarWithReason:@"header-materialization/resync"];`,
    'materialization-stage',
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

static BOOL RNSPrepareSharedToolbarBeforeRootPop(UINavigationController *navigationController,
                                                 UIViewController *destination,
                                                 NSString *reason)
{
  if (navigationController == nil || destination == nil || navigationController.viewControllers.count < 2 ||
      navigationController.viewControllers.firstObject != destination) return NO;
  RNSTabBarController *tabsController = nil;
  UIViewController *ancestor = navigationController;
  while (ancestor != nil && tabsController == nil) {
    tabsController = RNSFindSharedToolbarTabsController(ancestor);
    ancestor = ancestor.parentViewController;
  }
  if (tabsController == nil) return NO;

  UIViewController *source = navigationController.topViewController;
  [tabsController logToolbarAuditEvent:@"pre-pop.prepare.begin" reason:reason navigationController:navigationController fromController:source toController:destination];
  if ([reason hasPrefix:@"interactive"]) {
    [tabsController logToolbarAuditEvent:@"interactive-pop.prepare" reason:reason navigationController:navigationController fromController:source toController:destination];
  }
  BOOL prepared = [tabsController prepareSharedNavigationBarForPopToViewController:destination
                                                       inNavigationController:navigationController];
  [tabsController logToolbarAuditEvent:@"pre-pop.prepare.done"
                                reason:(prepared ? @"destination-ready" : @"no-root-toolbar-snapshot")
                   navigationController:navigationController
                         fromController:source
                           toController:destination];
  return prepared;
}

static void RNSMarkSharedToolbarRootDidShow(UINavigationController *navigationController,
                                            UIViewController *viewController,
                                            RNSTabBarController *tabsController)
{
  UIViewController *tabsScreen = tabsController.parentViewController;
  UINavigationController *sharedNavigationController = tabsScreen.navigationController;
  if (tabsScreen == nil || sharedNavigationController == nil ||
      navigationController != sharedNavigationController || viewController != tabsScreen ||
      sharedNavigationController.topViewController != tabsScreen) return;

  void (^markRootReady)(void) = ^{
    if (sharedNavigationController.topViewController != tabsScreen ||
        sharedNavigationController.transitionCoordinator != nil) return;
    [NSUserDefaults.standardUserDefaults setBool:YES
                                         forKey:@"com.emporio.rigatti.homeToolbar.rootDidShow"];
    [tabsController synchronizeSharedNavigationBarWithReason:@"shared-root-did-show"];
  };

  id<UIViewControllerTransitionCoordinator> coordinator = sharedNavigationController.transitionCoordinator;
  if (coordinator == nil) {
    markRootReady();
    return;
  }

  [coordinator animateAlongsideTransition:^(id<UIViewControllerTransitionCoordinatorContext> context) {
  } completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
    if (context.isCancelled) return;
    dispatch_async(dispatch_get_main_queue(), markRootReady);
  }];
}
`,
    'did-show-helper',
  );
  patch(
    stack,
    '        [_controller setViewControllers:newControllers animated:NO];\n        [_controller popViewControllerAnimated:YES];',
    `        [_controller setViewControllers:newControllers animated:NO];
        RNSPrepareSharedToolbarBeforeRootPop(_controller, top, @"normal-pop");
        [_controller popViewControllerAnimated:YES];`,
    PATCH_MARKERS.normalPopCall,
  );
  patch(
    stack,
    '    // _UIParallaxTransitionPanGestureRecognizer (other...)\n    [self cancelTouchesInParent];\n    return YES;\n  }\n\n#endif // TARGET_OS_TV',
    `    // _UIParallaxTransitionPanGestureRecognizer (other...)
    [self cancelTouchesInParent];
    UIViewController *interactiveDestination = _controller.viewControllers.count > 1
        ? _controller.viewControllers[_controller.viewControllers.count - 2] : nil;
    RNSPrepareSharedToolbarBeforeRootPop(_controller, interactiveDestination, @"interactive-native-gesture-accepted");
    return YES;
  }

#endif // TARGET_OS_TV`,
    PATCH_MARKERS.gestureBeginCall,
  );
  patch(
    stack,
    '      _interactionController = [RNSPercentDrivenInteractiveTransition new];\n      [_controller popViewControllerAnimated:YES];',
    `      _interactionController = [RNSPercentDrivenInteractiveTransition new];
      UIViewController *interactiveDestination = _controller.viewControllers.count > 1
          ? _controller.viewControllers[_controller.viewControllers.count - 2] : nil;
      RNSPrepareSharedToolbarBeforeRootPop(_controller, interactiveDestination, @"interactive-custom-swipe-began");
      [_controller popViewControllerAnimated:YES];`,
    PATCH_MARKERS.customSwipeBeginCall,
  );
  patch(
    stack,
    '    _interactionController = [RNSPercentDrivenInteractiveTransition new];\n    [_controller popViewControllerAnimated:YES];',
    `    _interactionController = [RNSPercentDrivenInteractiveTransition new];
    UIViewController *interactiveDestination = _controller.viewControllers.count > 1
        ? _controller.viewControllers[_controller.viewControllers.count - 2] : nil;
    RNSPrepareSharedToolbarBeforeRootPop(_controller, interactiveDestination, @"interactive-screen-transition");
    [_controller popViewControllerAnimated:YES];`,
    PATCH_MARKERS.screenTransitionCall,
  );
  patch(
    stack,
    '- (void)navigationController:(UINavigationController *)navigationController\n      willShowViewController:(UIViewController *)viewController\n                    animated:(BOOL)animated\n{\n  if (![viewController.view isKindOfClass:[RNSScreenView class]]) {',
    `- (void)navigationController:(UINavigationController *)navigationController
      willShowViewController:(UIViewController *)viewController
                    animated:(BOOL)animated
{
  RNSTabBarController *tabsController = nil;
  UIViewController *ancestor = navigationController;
  while (ancestor != nil && tabsController == nil) {
    tabsController = RNSFindSharedToolbarTabsController(ancestor);
    ancestor = ancestor.parentViewController;
  }
  id<UIViewControllerTransitionCoordinator> coordinator = navigationController.transitionCoordinator;
  UIViewController *fromController = [coordinator viewControllerForKey:UITransitionContextFromViewControllerKey];
  [tabsController logToolbarAuditEvent:@"navigation.transition.begin" reason:(animated ? @"animated" : @"not-animated") navigationController:navigationController fromController:fromController toController:viewController];
  [tabsController logToolbarAuditEvent:@"navigation.willShow" reason:(animated ? @"animated" : @"not-animated") navigationController:navigationController fromController:fromController toController:viewController];
  if (![viewController.view isKindOfClass:[RNSScreenView class]]) {`,
    'will-show-preflight',
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
  id<UIViewControllerTransitionCoordinator> coordinator = navigationController.transitionCoordinator;
  UIViewController *fromController = [coordinator viewControllerForKey:UITransitionContextFromViewControllerKey];
  [tabsController commitStagedSharedToolbarItemsFromViewController:viewController navigationController:navigationController];
  [tabsController logToolbarAuditEvent:@"navigation.didShow" reason:(animated ? @"animated" : @"not-animated") navigationController:navigationController fromController:fromController toController:viewController];
  [tabsController synchronizeSharedNavigationBarWithReason:@"navigation-did-show"];
  RNSMarkSharedToolbarRootDidShow(navigationController, viewController, tabsController);
  [tabsController logToolbarAuditEvent:@"toolbar.roles.after" reason:@"navigation-did-show" navigationController:navigationController fromController:fromController toController:viewController];
}
#endif

- (void)markChildUpdated`,
    'did-show-reconcile',
  );
}

function patchRNScreens(
  screensRoot = path.dirname(require.resolve('react-native-screens/package.json')),
) {
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
    `// ${PATCH_MARKERS.sharedToolbarIndex}\n- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{\n  UIViewController *target = selectedIndex < self.viewControllers.count ? self.viewControllers[selectedIndex] : nil;\n  if (target != nil) {\n    [self prepareSharedNavigationBarForViewController:target reason:@"tab-selection-index"];\n  }\n  [super setSelectedIndex:selectedIndex];\n`,
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
    'static void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController)',
    `// ${PATCH_MARKERS.nestedRootBarHelper}
static RNSTabBarController *RNSFindToolbarTabsControllerForNavigationController(UINavigationController *navigationController)
{
  UIViewController *ancestor = navigationController;
  while (ancestor != nil) {
    RNSTabBarController *tabsController = RNSFindTabBarControllerInViewController(ancestor);
    if (tabsController != nil) return tabsController;
    ancestor = ancestor.parentViewController;
  }
  return nil;
}

static BOOL RNSShouldSuppressNestedRootNavigationBar(UIViewController *viewController,
                                                     UINavigationController *navigationController,
                                                     RNSTabBarController **tabsControllerOut)
{
  RNSTabBarController *tabsController =
      RNSFindToolbarTabsControllerForNavigationController(navigationController);
  if (tabsControllerOut != nil) *tabsControllerOut = tabsController;
  if (tabsController == nil || navigationController == nil || viewController == nil ||
      navigationController.viewControllers.firstObject != viewController) return NO;

  UIViewController *tabsScreen = tabsController.parentViewController;
  UINavigationController *sharedNavigationController = tabsScreen.navigationController;
  if (sharedNavigationController == nil || sharedNavigationController == navigationController) return NO;

  BOOL isDestination = navigationController.topViewController == viewController;
  id<UIViewControllerTransitionCoordinator> transitionCoordinator =
      navigationController.transitionCoordinator;
  UIViewController *transitionDestination =
      [transitionCoordinator viewControllerForKey:UITransitionContextToViewControllerKey];
  return isDestination || transitionDestination == viewController;
}

static void RNSLogNestedRootBarSuppression(UINavigationController *nestedNavigationController,
                                          RNSTabBarController *tabsController)
{
#if TARGET_OS_SIMULATOR
  UIViewController *tabsScreen = tabsController.parentViewController;
  UINavigationController *sharedNavigationController = tabsScreen.navigationController;
  UINavigationBar *nestedBar = nestedNavigationController.navigationBar;
  UINavigationBar *sharedBar = sharedNavigationController.navigationBar;
  BOOL visibleSharedBar = sharedBar.window != nil && !sharedNavigationController.navigationBarHidden &&
      !sharedBar.hidden && sharedBar.alpha > 0;
  NSLog(@"[TOOLBAR-TRACE] nested-root-bar-suppressed nav-role=B nav=%p attached=%d hidden=%d shared-role=A nav=%p attached=%d hidden=%d visible-shared-bar=%d",
      nestedNavigationController, nestedBar.window != nil, nestedNavigationController.navigationBarHidden,
      sharedNavigationController, sharedBar.window != nil, sharedNavigationController.navigationBarHidden,
      visibleSharedBar);
#endif
}

static void RNSSynchronizeSharedTabToolbar(UIViewController *viewController, UINavigationController *navigationController)`,
    PATCH_MARKERS.nestedRootBarHelper,
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
  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '  [navctr setNavigationBarHidden:NO animated:animated];',
    `  RNSTabBarController *toolbarTabsController = nil;\n  if (RNSShouldSuppressNestedRootNavigationBar(vc, navctr, &toolbarTabsController)) {\n    [navctr setNavigationBarHidden:YES animated:NO];\n    RNSLogNestedRootBarSuppression(navctr, toolbarTabsController);\n  } else {\n    [navctr setNavigationBarHidden:NO animated:animated];\n  }`,
    PATCH_MARKERS.nestedRootBarSuppression,
  );
  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '  if (navctr == nil) {\n    return;\n  }',
    `  if (navctr == nil) {
    return;
  }
  RNSTabBarController *toolbarTabsController = RNSFindToolbarTabsControllerForNavigationController(navctr);
  BOOL preservePreparedSharedToolbarItems =
      [toolbarTabsController consumeSharedToolbarPrePopPreparationForViewController:vc];`,
    PATCH_MARKERS.prePopHeaderPreservation,
  );
  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '  navitem.titleView = nil;\n  navitem.leftBarButtonItems = nil;\n  navitem.rightBarButtonItems = nil;',
    `  navitem.titleView = nil;
  // ${PATCH_MARKERS.prePopHeaderReset}
  if (!preservePreparedSharedToolbarItems) {
    navitem.leftBarButtonItems = nil;
    navitem.rightBarButtonItems = nil;
  }`,
    PATCH_MARKERS.prePopHeaderReset,
  );
  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '      case RNSScreenStackHeaderSubviewTypeLeft: {\n        NSArray<UIBarButtonItem *> *currentItems = navitem.leftBarButtonItems ?: @[];',
    `      case RNSScreenStackHeaderSubviewTypeLeft: {
        if (preservePreparedSharedToolbarItems) break; // ${PATCH_MARKERS.prePopHeaderLeftSubview}
        NSArray<UIBarButtonItem *> *currentItems = navitem.leftBarButtonItems ?: @[];`,
    PATCH_MARKERS.prePopHeaderLeftSubview,
  );
  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '      case RNSScreenStackHeaderSubviewTypeRight: {\n        NSArray<UIBarButtonItem *> *currentItems = navitem.rightBarButtonItems ?: @[];',
    `      case RNSScreenStackHeaderSubviewTypeRight: {
        if (preservePreparedSharedToolbarItems) break; // ${PATCH_MARKERS.prePopHeaderRightSubview}
        NSArray<UIBarButtonItem *> *currentItems = navitem.rightBarButtonItems ?: @[];`,
    PATCH_MARKERS.prePopHeaderRightSubview,
  );
  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
    '  navitem.leftBarButtonItems = [config barButtonItemsFromConfigs:config.headerLeftBarButtonItems\n                                                withCurrentItems:navitem.leftBarButtonItems];\n  navitem.rightBarButtonItems = [config barButtonItemsFromConfigs:config.headerRightBarButtonItems\n                                                 withCurrentItems:navitem.rightBarButtonItems];',
    `  // ${PATCH_MARKERS.prePopHeaderAssignments}
  if (!preservePreparedSharedToolbarItems) {
    navitem.leftBarButtonItems = [config barButtonItemsFromConfigs:config.headerLeftBarButtonItems
                                                  withCurrentItems:navitem.leftBarButtonItems];
    navitem.rightBarButtonItems = [config barButtonItemsFromConfigs:config.headerRightBarButtonItems
                                                   withCurrentItems:navitem.rightBarButtonItems];
  }`,
    PATCH_MARKERS.prePopHeaderAssignments,
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

const configPlugin = createRunOncePlugin(
  withRNScreensHideBottomBarWhenPushed,
  'with-rnscreens-hide-bottom-bar-when-pushed',
  '1.4.0',
);

Object.defineProperty(configPlugin, '__patchRNScreensForTesting', { value: patchRNScreens });
module.exports = configPlugin;
