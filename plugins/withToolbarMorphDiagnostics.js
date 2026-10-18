const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PLUGIN_MARKER = 'Emporio Rigatti: temporary toolbar morph OSLog diagnostics';
const HEADER_MARKER = `${PLUGIN_MARKER} shared native logger`;

const NATIVE_LOGGER_HEADER = `// ${HEADER_MARKER}
#pragma once

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <math.h>
#import <os/log.h>
#import <objc/runtime.h>

static inline os_log_t RNSCreateToolbarMorphDiagnosticsLogger(void)
{
  static os_log_t logger;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSString *subsystem = NSBundle.mainBundle.bundleIdentifier ?: @"com.pareact.mobile";
    logger = os_log_create(subsystem.UTF8String, "ToolbarMorphDiagnostics");
  });
  return logger;
}

static inline NSString *RNSCurrentToolbarMorphExperimentVariant(void)
{
  id variant = NSBundle.mainBundle.infoDictionary[@"EmporioToolbarMorphExperimentVariant"];
  return [variant isEqual:@"B"] ? @"B" : @"A";
}

static inline NSString *RNSRoleForToolbarMorphIdentifier(NSString *identifier)
{
  if ([identifier isEqualToString:@"toolbar-morph:home-search"] ||
      [identifier hasPrefix:@"home-toolbar-item:search:"]) return @"home-search";
  if ([identifier isEqualToString:@"toolbar-morph:settings-profile"]) return @"settings-profile";
  return nil;
}

static inline NSString *RNSFindToolbarMorphRoleInView(UIView *view, NSUInteger depth)
{
  if (view == nil || depth > 8) return nil;
  NSString *role = RNSRoleForToolbarMorphIdentifier(view.accessibilityIdentifier);
  if (role != nil) return role;
  for (UIView *child in view.subviews) {
    role = RNSFindToolbarMorphRoleInView(child, depth + 1);
    if (role != nil) return role;
  }
  return nil;
}

static inline NSString *RNSRoleForToolbarMorphItem(UIBarButtonItem *item)
{
  NSString *customRole = RNSFindToolbarMorphRoleInView(item.customView, 0);
  if (customRole != nil) return customRole;
  NSArray<NSString *> *financeReferenceLabels = @[@"Período financeiro", @"Selecionar período"];
  if (item.accessibilityLabel != nil && [financeReferenceLabels containsObject:item.accessibilityLabel]) {
    return @"finance-reference";
  }
  return nil;
}

static inline NSString *RNSToolbarMorphToken(id object, NSString *kind)
{
  if (object == nil) return @"none";
  SEL selector = NSSelectorFromString([NSString stringWithFormat:@"rnsToolbarMorphToken_%@", kind]);
  const void *key = (const void *)selector;
  NSString *token = objc_getAssociatedObject(object, key);
  if (token == nil) {
    token = [NSString stringWithFormat:@"%@-%@", kind, [[[NSUUID UUID] UUIDString] lowercaseString]];
    objc_setAssociatedObject(object, key, token, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  return token;
}

static inline NSString *RNSSafeToolbarMorphReason(NSString *reason)
{
  NSArray<NSString *> *allowed = @[
    @"header_materialization", @"header_subview_invalidated", @"materialization",
    @"tab-selection-index", @"programmatic-selection", @"tab-selection-shouldSelect",
    @"container-resync", @"header-materialization/resync", @"navigation-did-show",
    @"tab-transition-completion",
    @"detached_custom_view", @"already_attached_or_not_repairable", @"bar_window_missing",
    @"destination_not_selected", @"source_window_missing", @"replacement_identity_unstable",
    @"attachment_checked",
    @"transition_active", @"source_unavailable", @"same_instances", @"setter_completed",
    @"experiment_b_skip_once", @"experiment_b_recovery", @"experiment_b_shared_side_preserved",
    @"initial_materialization", @"navigation-pop-will-show", @"pop_staging_predicates",
    @"pop_owner_before_transfer", @"pop_owner_after_source_release", @"pop_owner_after_transfer",
    @"coordinator_capture_owner_before",
    @"coordinator_capture_owner_after", @"coordinator_apply_owner_before", @"coordinator_apply_owner_after",
    @"attachment_repair_owner_before", @"attachment_repair_owner_after"
  ];
  return [allowed containsObject:reason] ? reason : @"other";
}

static inline NSString *RNSSafeToolbarMorphOperation(NSString *operation)
{
  NSArray<NSString *> *allowed = @[@"initial", @"push", @"pop", @"replace", @"other"];
  return [allowed containsObject:operation] ? operation : @"other";
}

static inline NSString *RNSSafeToolbarMorphStageResult(NSString *result)
{
  NSArray<NSString *> *allowed = @[
    @"not_pop", @"tabs_controller_unavailable", @"navigation_context_unavailable",
    @"shared_navigation_context_unavailable", @"settings_shared_bar_visible",
    @"not_target_root_pop", @"root_items_unavailable", @"root_items_empty",
    @"staged_home_root", @"staged_settings_root", @"staged_finance_root", @"already_staged", @"pending",
    @"staging_started", @"toolbar_materialized", @"completed", @"cancelled"
  ];
  return [allowed containsObject:result] ? result : @"other";
}

static inline void RNSLogToolbarMorphItem(
    NSString *event,
    UIBarButtonItem *item,
    UIBarButtonItem *counterpart,
    NSString *side,
    NSString *reason,
    NSString *result,
    UINavigationBar *bar,
    BOOL animated,
    BOOL transitionActive)
{
  NSString *role = RNSRoleForToolbarMorphItem(item);
  if (role == nil) return;

  UIView *customView = item.customView;
  UIWindow *viewWindow = customView.window;
  UIWindow *barWindow = bar.window;
  BOOL attached = customView != nil && bar != nil && [customView isDescendantOfView:bar];
  BOOL sameWindow = viewWindow != nil && barWindow != nil && viewWindow == barWindow;
  NSInteger width = customView != nil ? (NSInteger)lrint(customView.bounds.size.width) : -1;
  NSInteger height = customView != nil ? (NSInteger)lrint(customView.bounds.size.height) : -1;
  NSInteger hidden = customView != nil ? (NSInteger)customView.hidden : -1;
  NSInteger alphaMilli = customView != nil ? (NSInteger)lrint(customView.alpha * 1000.0) : -1;
  NSString *itemToken = RNSToolbarMorphToken(item, @"item");
  NSString *customToken = RNSToolbarMorphToken(customView, @"view");
  NSString *counterpartToken = RNSToolbarMorphToken(counterpart, @"item");
  NSInteger sameInstance = counterpart != nil ? (item == counterpart) : -1;
  NSString *itemClass = item != nil ? NSStringFromClass(item.class) : @"none";
  NSString *customClass = customView != nil ? NSStringFromClass(customView.class) : @"none";
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);

  os_log_with_type(
      RNSCreateToolbarMorphDiagnosticsLogger(),
      OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=%{public}@ item=%{public}@ counterpart=%{public}@ same_instance=%{public}ld custom_view=%{public}@ side=%{public}@ reason=%{public}@ result=%{public}@ uptime_ms=%{public}llu item_class=%{public}@ custom_class=%{public}@ custom_available=%{public}d window=%{public}d bar_window=%{public}d same_window=%{public}d attached=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}ld alpha_milli=%{public}ld animated=%{public}d transition_active=%{public}d",
      event, RNSCurrentToolbarMorphExperimentVariant(), role, itemToken, counterpartToken, (long)sameInstance, customToken, side,
      RNSSafeToolbarMorphReason(reason), result, uptimeMilliseconds, itemClass, customClass,
      customView != nil, viewWindow != nil, barWindow != nil, sameWindow, attached,
      (long)width, (long)height, (long)hidden, (long)alphaMilli, animated, transitionActive);
}

static inline UIBarButtonItem *RNSFindToolbarMorphCounterpart(
    NSArray<UIBarButtonItem *> *items,
    NSString *role)
{
  for (UIBarButtonItem *item in items) {
    if ([RNSRoleForToolbarMorphItem(item) isEqualToString:role]) return item;
  }
  return nil;
}

static inline void RNSLogToolbarMorphItems(
    NSString *event,
    NSArray<UIBarButtonItem *> *items,
    NSArray<UIBarButtonItem *> *counterpartItems,
    NSString *side,
    NSString *reason,
    NSString *result,
    UINavigationBar *bar,
    BOOL animated,
    BOOL transitionActive)
{
  for (UIBarButtonItem *item in items) {
    NSString *role = RNSRoleForToolbarMorphItem(item);
    if (role == nil) continue;
    UIBarButtonItem *counterpart = RNSFindToolbarMorphCounterpart(counterpartItems, role);
    RNSLogToolbarMorphItem(event, item, counterpart, side, reason, result, bar, animated, transitionActive);
  }
}

static inline void RNSLogToolbarMorphTransition(
    NSString *event,
    NSString *source,
    NSInteger fromIndex,
    NSInteger toIndex,
    BOOL animated,
    BOOL transitionActive,
    BOOL cancelled)
{
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  os_log_with_type(
      RNSCreateToolbarMorphDiagnosticsLogger(),
      OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=coordinator source=%{public}@ from_index=%{public}ld to_index=%{public}ld uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d cancelled=%{public}d",
      event, RNSCurrentToolbarMorphExperimentVariant(), source, (long)fromIndex, (long)toIndex, uptimeMilliseconds, animated, transitionActive, cancelled);
}

static inline void RNSLogToolbarMorphNavigationTokens(
    NSString *event,
    NSString *navigationToken,
    NSString *fromToken,
    NSString *toToken,
    NSString *operation,
    NSString *result,
    NSInteger stackDepth,
    BOOL animated,
    BOOL transitionActive,
    BOOL cancelled)
{
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  os_log_with_type(
      RNSCreateToolbarMorphDiagnosticsLogger(),
      OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=coordinator navigation=%{public}@ from=%{public}@ to=%{public}@ operation=%{public}@ result=%{public}@ stack_depth=%{public}ld uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d cancelled=%{public}d",
      event, RNSCurrentToolbarMorphExperimentVariant(), navigationToken, fromToken, toToken,
      RNSSafeToolbarMorphOperation(operation), RNSSafeToolbarMorphStageResult(result),
      (long)stackDepth, uptimeMilliseconds, animated, transitionActive, cancelled);
}

static inline void RNSLogToolbarMorphNavigation(
    NSString *event,
    UINavigationController *navigationController,
    UIViewController *fromViewController,
    UIViewController *toViewController,
    NSString *operation,
    NSString *result,
    BOOL animated,
    BOOL transitionActive,
    BOOL cancelled)
{
  RNSLogToolbarMorphNavigationTokens(
      event,
      RNSToolbarMorphToken(navigationController, @"navigation"),
      RNSToolbarMorphToken(fromViewController, @"controller"),
      RNSToolbarMorphToken(toViewController, @"controller"),
      operation,
      result,
      (NSInteger)navigationController.viewControllers.count,
      animated,
      transitionActive,
      cancelled);
}

static inline BOOL RNSToolbarMorphOwnerContainsItem(UINavigationItem *owner, UIBarButtonItem *candidate)
{
  if (owner == nil || candidate == nil) return NO;
  for (UIBarButtonItem *item in owner.leftBarButtonItems ?: @[]) if (item == candidate) return YES;
  for (UIBarButtonItem *item in owner.rightBarButtonItems ?: @[]) if (item == candidate) return YES;
  return NO;
}

static inline void RNSLogToolbarMorphOwnership(
    NSString *event,
    NSArray<UIBarButtonItem *> *items,
    UINavigationItem *owner,
    UINavigationItem *otherOwner,
    NSString *side,
    NSString *result,
    BOOL animated,
    BOOL transitionActive)
{
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  if (items.count == 0) {
    os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
        "event=%{public}@ variant=%{public}@ role=coordinator item=none side=%{public}@ owner=%{public}@ other_owner=%{public}@ result=%{public}@ uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d",
        event, RNSCurrentToolbarMorphExperimentVariant(), side,
        RNSToolbarMorphToken(owner, @"navigation_item"), RNSToolbarMorphToken(otherOwner, @"navigation_item"),
        result, uptimeMilliseconds, animated, transitionActive);
    return;
  }
  for (UIBarButtonItem *item in items) {
    NSString *role = RNSRoleForToolbarMorphItem(item);
    if (role == nil) continue;
    UIView *customView = item.customView;
    os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
        "event=%{public}@ variant=%{public}@ role=%{public}@ item=%{public}@ custom_view=%{public}@ side=%{public}@ owner=%{public}@ other_owner=%{public}@ owner_contains=%{public}d other_owner_contains=%{public}d attached=%{public}d window=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}d alpha_milli=%{public}ld result=%{public}@ uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d",
        event, RNSCurrentToolbarMorphExperimentVariant(), role, RNSToolbarMorphToken(item, @"item"),
        RNSToolbarMorphToken(customView, @"view"), side,
        RNSToolbarMorphToken(owner, @"navigation_item"), RNSToolbarMorphToken(otherOwner, @"navigation_item"),
        RNSToolbarMorphOwnerContainsItem(owner, item), RNSToolbarMorphOwnerContainsItem(otherOwner, item),
        customView != nil && customView.superview != nil, customView.window != nil,
        (long)(customView != nil ? lrint(customView.bounds.size.width) : -1),
        (long)(customView != nil ? lrint(customView.bounds.size.height) : -1),
        customView.hidden, (long)(customView != nil ? lrint(customView.alpha * 1000.0) : -1),
        result, uptimeMilliseconds, animated, transitionActive);
  }
}

static inline NSString *RNSRoleForToolbarMorphItems(NSArray<UIBarButtonItem *> *items)
{
  for (UIBarButtonItem *item in items) {
    NSString *role = RNSRoleForToolbarMorphItem(item);
    if (role != nil) return role;
  }
  return @"unknown";
}

static inline void RNSLogToolbarMorphPopPredicates(
    UINavigationController *navigationController,
    UINavigationController *expectedNavigationController,
    UINavigationController *expectedNestedNavigationController,
    UIViewController *fromViewController,
    UIViewController *toViewController,
    NSInteger selectedTabIndex,
    NSInteger expectedTabIndex,
    NSInteger nestedStackDepth,
    BOOL sharedTabsControllerIsTop,
    BOOL destinationIsTabsRoot,
    BOOL destinationIsNestedRoot,
    BOOL homeRootPredicate,
    BOOL settingsSharedRootPredicate,
    BOOL financeSharedRootPredicate,
    BOOL settingsNestedRootPredicate,
    UINavigationItem *sourceOwner,
    UINavigationItem *destinationOwner,
    NSArray<UIBarButtonItem *> *items,
    NSString *result)
{
  NSString *target = selectedTabIndex == 0 ? @"home" :
      (selectedTabIndex == 3 ? @"settings" : (selectedTabIndex == 1 ? @"finance" : @"other"));
  NSString *role = RNSRoleForToolbarMorphItems(items);
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=pop_staging_predicates variant=%{public}@ role=%{public}@ target=%{public}@ navigation=%{public}@ expected_navigation=%{public}@ navigation_matches_shared=%{public}d expected_nested_navigation=%{public}@ navigation_matches_selected_nested=%{public}d from=%{public}@ to=%{public}@ shared_tabs_controller_is_top=%{public}d destination_is_tabs_root=%{public}d selected_tab_index=%{public}ld expected_tab_index=%{public}ld stack_depth=%{public}ld nested_stack_depth=%{public}ld destination_is_nested_root=%{public}d home_root_predicate=%{public}d settings_shared_root_predicate=%{public}d finance_shared_root_predicate=%{public}d settings_nested_root_predicate=%{public}d source_owner=%{public}@ destination_owner=%{public}@ result=%{public}@ uptime_ms=%{public}llu transition_active=%{public}d",
      RNSCurrentToolbarMorphExperimentVariant(), role, target,
      RNSToolbarMorphToken(navigationController, @"navigation"),
      RNSToolbarMorphToken(expectedNavigationController, @"navigation"),
      navigationController != nil && navigationController == expectedNavigationController,
      RNSToolbarMorphToken(expectedNestedNavigationController, @"navigation"),
      navigationController != nil && navigationController == expectedNestedNavigationController,
      RNSToolbarMorphToken(fromViewController, @"controller"),
      RNSToolbarMorphToken(toViewController, @"controller"), sharedTabsControllerIsTop, destinationIsTabsRoot,
      (long)selectedTabIndex, (long)expectedTabIndex,
      (long)navigationController.viewControllers.count, (long)nestedStackDepth,
      destinationIsNestedRoot, homeRootPredicate, settingsSharedRootPredicate,
      financeSharedRootPredicate, settingsNestedRootPredicate, RNSToolbarMorphToken(sourceOwner, @"navigation_item"),
      RNSToolbarMorphToken(destinationOwner, @"navigation_item"), result, uptimeMilliseconds,
      navigationController.transitionCoordinator != nil);
}

static inline void RNSLogToolbarMorphViewLifecycle(
    NSString *event,
    UIView *view,
    UIView *targetSuperview)
{
  NSString *role = RNSFindToolbarMorphRoleInView(view, 0);
  if (role == nil) return;
  UIWindow *window = view.window;
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=%{public}@ view=%{public}@ superview=%{public}@ target_superview=%{public}@ window=%{public}@ attached=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}d alpha_milli=%{public}ld uptime_ms=%{public}llu",
      event, RNSCurrentToolbarMorphExperimentVariant(), role,
      RNSToolbarMorphToken(view, @"view"), RNSToolbarMorphToken(view.superview, @"superview"),
      RNSToolbarMorphToken(targetSuperview, @"superview"), RNSToolbarMorphToken(window, @"window"),
      view.superview != nil && window != nil,
      (long)lrint(view.bounds.size.width), (long)lrint(view.bounds.size.height), view.hidden,
      (long)lrint(view.alpha * 1000.0), uptimeMilliseconds);
}

static inline void RNSLogToolbarMorphTabSelection(
    NSString *event,
    NSString *source,
    UINavigationController *navigationController,
    UIViewController *fromViewController,
    UIViewController *toViewController,
    NSInteger fromIndex,
    NSInteger toIndex,
    BOOL transitionActive,
    BOOL cancelled)
{
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=coordinator source=%{public}@ navigation=%{public}@ from=%{public}@ to=%{public}@ from_index=%{public}ld to_index=%{public}ld transition_active=%{public}d cancelled=%{public}d uptime_ms=%{public}llu",
      event, RNSCurrentToolbarMorphExperimentVariant(), source,
      RNSToolbarMorphToken(navigationController, @"navigation"),
      RNSToolbarMorphToken(fromViewController, @"controller"),
      RNSToolbarMorphToken(toViewController, @"controller"), (long)fromIndex, (long)toIndex,
      transitionActive, cancelled, uptimeMilliseconds);
}

static inline void RNSObserveToolbarMorphTabTransition(
    id<UIViewControllerTransitionCoordinator> coordinator,
    NSString *source,
    UINavigationController *navigationController,
    UIViewController *fromViewController,
    UIViewController *toViewController,
    NSInteger fromIndex,
    NSInteger toIndex)
{
  if (coordinator == nil) {
    RNSLogToolbarMorphTabSelection(@"tab_transition_observer_unavailable", source,
        navigationController, fromViewController, toViewController, fromIndex, toIndex, NO, NO);
    return;
  }
  RNSLogToolbarMorphTabSelection(@"tab_transition_observer_registered", source,
      navigationController, fromViewController, toViewController, fromIndex, toIndex, YES, NO);
  [coordinator animateAlongsideTransition:nil completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
    RNSLogToolbarMorphTabSelection(@"tab_transition_completed", source, navigationController,
        fromViewController, toViewController, fromIndex, toIndex, NO, context.isCancelled);
  }];
}

static inline void RNSObserveToolbarMorphTransition(
    id<UIViewControllerTransitionCoordinator> coordinator,
    NSString *source,
    NSInteger fromIndex,
    NSInteger toIndex,
    BOOL animated)
{
  if (coordinator == nil) {
    RNSLogToolbarMorphTransition(@"transition_observer_unavailable", source, fromIndex, toIndex, animated, NO, NO);
    return;
  }
  RNSLogToolbarMorphTransition(@"transition_observer_registered", source, fromIndex, toIndex, animated, YES, NO);
  BOOL registered = [coordinator animateAlongsideTransition:nil completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
    RNSLogToolbarMorphTransition(
        @"transition_completed", source, fromIndex, toIndex, animated,
        NO, context.isCancelled);
  }];
  if (!registered) {
    RNSLogToolbarMorphTransition(@"transition_observer_registration_failed", source, fromIndex, toIndex, animated, YES, NO);
  }
}

static inline void RNSObserveToolbarMorphNavigationTransition(
    UINavigationController *navigationController,
    UIViewController *fromViewController,
    UIViewController *toViewController,
    NSString *operation,
    BOOL animated)
{
  id<UIViewControllerTransitionCoordinator> coordinator = navigationController.transitionCoordinator;
  if (coordinator == nil) {
    RNSLogToolbarMorphNavigation(
        @"navigation_transition_observer_unavailable", navigationController, fromViewController,
        toViewController, operation, @"navigation_context_unavailable", animated, NO, NO);
    return;
  }

  NSString *navigationToken = RNSToolbarMorphToken(navigationController, @"navigation");
  NSString *fromToken = RNSToolbarMorphToken(fromViewController, @"controller");
  NSString *toToken = RNSToolbarMorphToken(toViewController, @"controller");
  NSString *safeOperation = RNSSafeToolbarMorphOperation(operation);
  RNSLogToolbarMorphNavigationTokens(
      @"navigation_transition_observer_registered", navigationToken, fromToken, toToken,
      safeOperation, @"staging_started", (NSInteger)navigationController.viewControllers.count,
      animated, YES, NO);
  BOOL registered = [coordinator animateAlongsideTransition:nil
      completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
        RNSLogToolbarMorphNavigationTokens(
            @"navigation_transition_completed", navigationToken, fromToken, toToken,
            safeOperation, context.isCancelled ? @"cancelled" : @"completed",
            (NSInteger)navigationController.viewControllers.count, animated, NO, context.isCancelled);
      }];
  if (!registered) {
    RNSLogToolbarMorphNavigationTokens(
        @"navigation_transition_observer_registration_failed", navigationToken, fromToken, toToken,
        safeOperation, @"navigation_context_unavailable", (NSInteger)navigationController.viewControllers.count,
        animated, YES, NO);
  }
}
`;

function insertAfter(filePath, needle, addition, marker) {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (contents.includes(marker)) return;
  if (!contents.includes(needle)) {
    throw new Error(
      `Could not apply ${PLUGIN_MARKER} at ${filePath}: expected source anchor was missing.`,
    );
  }
  fs.writeFileSync(filePath, contents.replace(needle, `${needle}\n// ${marker}\n${addition}`));
}

function insertBefore(filePath, needle, addition, marker) {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (contents.includes(marker)) return;
  if (!contents.includes(needle)) {
    throw new Error(
      `Could not apply ${PLUGIN_MARKER} at ${filePath}: expected source anchor was missing.`,
    );
  }
  fs.writeFileSync(filePath, contents.replace(needle, `// ${marker}\n${addition}\n${needle}`));
}

function ensureLoggerHeader(screensRoot) {
  const headerPath = path.join(screensRoot, 'ios', 'RNSToolbarMorphDiagnostics.h');
  if (fs.existsSync(headerPath)) {
    const existingHeader = fs.readFileSync(headerPath, 'utf8');
    if (!existingHeader.includes(HEADER_MARKER)) {
      throw new Error(`Refusing to replace an unrelated file at ${headerPath}.`);
    }
    if (existingHeader !== NATIVE_LOGGER_HEADER) {
      fs.writeFileSync(headerPath, NATIVE_LOGGER_HEADER);
    }
    return;
  }
  fs.writeFileSync(headerPath, NATIVE_LOGGER_HEADER);
}

function patchScreens(screensRoot) {
  const screensPackage = require(path.join(screensRoot, 'package.json'));
  if (screensPackage.version !== '4.30.0') {
    throw new Error('Toolbar morph diagnostics are anchored to react-native-screens 4.30.0.');
  }

  const controllerPath = path.join(screensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm');
  const controller = fs.readFileSync(controllerPath, 'utf8');
  if (!controller.includes('Emporio Rigatti: shared tab toolbar controller')) {
    throw new Error(
      'Toolbar morph diagnostics must run after the existing shared-toolbar coordinator patch.',
    );
  }

  ensureLoggerHeader(screensRoot);

  const headerSubview = path.join(screensRoot, 'ios', 'RNSScreenStackHeaderSubview.mm');
  insertAfter(
    headerSubview,
    '#import "RNSScreenStackHeaderSubview.h"',
    '#import "RNSToolbarMorphDiagnostics.h"',
    `${PLUGIN_MARKER} custom accessory logger import`,
  );
  insertAfter(
    headerSubview,
    '    [self configureBarButtonItem];',
    `    RNSLogToolbarMorphItem(@"item_created", _barButtonItem, nil,
        _type == RNSScreenStackHeaderSubviewTypeLeft ? @"left" : @"right",
        @"header_materialization", @"created", nil, NO, NO);`,
    `${PLUGIN_MARKER} custom item creation`,
  );
  insertBefore(
    headerSubview,
    '  _barButtonItem = nil;',
    `  if (_barButtonItem != nil) {
    RNSLogToolbarMorphItem(@"item_invalidated", _barButtonItem, nil,
        _type == RNSScreenStackHeaderSubviewTypeLeft ? @"left" : @"right",
        @"header_subview_invalidated", @"invalidated", nil, NO, NO);
  }`,
    `${PLUGIN_MARKER} custom item invalidation`,
  );
  insertBefore(
    headerSubview,
    '#pragma mark - RCTComponentViewProtocol',
    `- (void)willMoveToSuperview:(UIView *)newSuperview
{
  RNSLogToolbarMorphViewLifecycle(@"custom_view_will_move", self, newSuperview);
  [super willMoveToSuperview:newSuperview];
}

- (void)didMoveToSuperview
{
  [super didMoveToSuperview];
  RNSLogToolbarMorphViewLifecycle(@"custom_view_did_move", self, nil);
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  RNSLogToolbarMorphViewLifecycle(@"custom_view_window_changed", self, nil);
}`,
    `${PLUGIN_MARKER} custom accessory attachment lifecycle`,
  );

  const headerConfig = path.join(screensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm');
  insertAfter(
    headerConfig,
    '#import "RNSScreenStackHeaderConfig.h"',
    '#import "RNSToolbarMorphDiagnostics.h"',
    `${PLUGIN_MARKER} declarative item logger import`,
  );
  insertAfter(
    headerConfig,
    '          imageLoader:_imageLoader];',
    `      RNSLogToolbarMorphItem(@"item_created", item, nil, @"header_config",
          @"header_materialization", @"created", nil, NO, NO);`,
    `${PLUGIN_MARKER} declarative item creation`,
  );

  insertAfter(
    controllerPath,
    '#import "RNSTabBarController.h"',
    '#import "RNSToolbarMorphDiagnostics.h"',
    `${PLUGIN_MARKER} coordinator logger import`,
  );

  insertAfter(
    controllerPath,
    '  NSDictionary *materialized = @{@"left": item.leftBarButtonItems ?: @[], @"right": item.rightBarButtonItems ?: @[]};',
    `  BOOL isFirstToolbarMaterialization =
      objc_getAssociatedObject(item, &RNSSharedToolbarMaterializedItemsKey) == nil;
  if (isFirstToolbarMaterialization) {
    RNSLogToolbarMorphNavigation(@"toolbar_first_materialization", navigationController, nil,
        viewController, @"initial", @"toolbar_materialized", NO,
        self.transitionCoordinator != nil || viewController.transitionCoordinator != nil ||
            navigationController.transitionCoordinator != nil, NO);
  }
  RNSLogToolbarMorphItems(@"coordinator_capture", materialized[@"left"], nil,
      @"left", @"materialization", @"captured", navigationController.navigationBar, NO,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || navigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"coordinator_capture", materialized[@"right"], nil,
      @"right", @"materialization", @"captured", navigationController.navigationBar, NO,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || navigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_before", materialized[@"left"], item,
      self.parentViewController.navigationItem, @"left", @"before_clear", NO,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || navigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_before", materialized[@"right"], item,
      self.parentViewController.navigationItem, @"right", @"before_clear", NO,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || navigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator capture`,
  );
  insertAfter(
    controllerPath,
    '  [item setRightBarButtonItems:nil animated:NO];',
    `  RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_after", materialized[@"left"], item,
      self.parentViewController.navigationItem, @"left", @"source_cleared", NO,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || navigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphOwnership(@"coordinator_capture_owner_after", materialized[@"right"], item,
      self.parentViewController.navigationItem, @"right", @"source_cleared", NO,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || navigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator capture ownership result`,
  );

  insertAfter(
    controllerPath,
    '  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)) {\n    [sharedNavigationItem setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement];\n  }',
    `  RNSLogToolbarMorphOwnership(@"coordinator_apply_owner_after", leftItems, sharedNavigationItem,
      sourceNavigationItem, @"left", @"destination_after_apply", shouldAnimateToolbarItemReplacement,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphOwnership(@"coordinator_apply_owner_after", rightItems, sharedNavigationItem,
      sourceNavigationItem, @"right", @"destination_after_apply", shouldAnimateToolbarItemReplacement,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator apply ownership result`,
  );
  insertBefore(
    controllerPath,
    '  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)) {\n    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement];\n  }',
    `  RNSLogToolbarMorphOwnership(@"coordinator_apply_owner_before", leftItems, sharedNavigationItem,
      sourceNavigationItem, @"left", @"before_apply", shouldAnimateToolbarItemReplacement,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphOwnership(@"coordinator_apply_owner_before", rightItems, sharedNavigationItem,
      sourceNavigationItem, @"right", @"before_apply", shouldAnimateToolbarItemReplacement,
      self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator apply ownership decision`,
  );

  insertAfter(
    controllerPath,
    '  BOOL isSettingsNestedRootPop = navigationController == selectedNestedNavigationController &&\n      sharedTabsControllerIsTop &&\n      toViewController == selectedNestedNavigationController.viewControllers.firstObject &&\n      selectedNestedNavigationController.viewControllers.count == 1 && selectedTabIndex == 3;',
    `  UINavigationItem *diagnosticRootOwner = selectedNestedNavigationController.topViewController.navigationItem;
  NSDictionary *diagnosticRootItems =
      objc_getAssociatedObject(diagnosticRootOwner, &RNSSharedToolbarMaterializedItemsKey);
  RNSLogToolbarMorphPopPredicates(navigationController, sharedNavigationController,
      selectedNestedNavigationController, fromViewController, toViewController, selectedTabIndex,
      selectedTabIndex == 0 ? 0 : (selectedTabIndex == 3 ? 3 : (selectedTabIndex == 1 ? 1 : -1)),
      selectedNestedNavigationController.viewControllers.count,
      sharedTabsControllerIsTop, toViewController == tabsScreenViewController,
      selectedNestedNavigationController.viewControllers.count == 1 &&
          toViewController == selectedNestedNavigationController.viewControllers.firstObject,
      isHomeSharedRootPop, isSettingsSharedRootPop, isFinanceSharedRootPop, isSettingsNestedRootPop,
      diagnosticRootOwner, destinationNavigationItem,
      [(diagnosticRootItems[@"left"] ?: @[]) arrayByAddingObjectsFromArray:(diagnosticRootItems[@"right"] ?: @[])],
      @"predicate_evaluated");`,
    `${PLUGIN_MARKER} pop predicate evaluation`,
  );

  insertAfter(
    controllerPath,
    '  NSArray<UIBarButtonItem *> *rightItems = materializedItems[@"right"] ?: @[];',
    `  RNSLogToolbarMorphItems(@"pop_staging_source", leftItems, nil,
      @"left", @"navigation-pop-will-show", @"staging_started", navigationController.navigationBar, NO, YES);
  RNSLogToolbarMorphItems(@"pop_staging_source", rightItems, nil,
      @"right", @"navigation-pop-will-show", @"staging_started", navigationController.navigationBar, NO, YES);`,
    `${PLUGIN_MARKER} pop staging source items`,
  );

  insertAfter(
    controllerPath,
    '[destinationNavigationItem setRightBarButtonItems:rightItems.count > 0 ? rightItems : nil animated:NO];',
    `  RNSLogToolbarMorphItems(@"pop_staging_destination", destinationNavigationItem.leftBarButtonItems ?: @[], leftItems,
      @"left", @"navigation-pop-will-show", @"staged", navigationController.navigationBar, NO, YES);
  RNSLogToolbarMorphItems(@"pop_staging_destination", destinationNavigationItem.rightBarButtonItems ?: @[], rightItems,
      @"right", @"navigation-pop-will-show", @"staged", navigationController.navigationBar, NO, YES);
  RNSLogToolbarMorphOwnership(@"pop_owner_after_transfer", leftItems, destinationNavigationItem,
      sourceNavigationItem, @"left", successResult, NO, YES);
  RNSLogToolbarMorphOwnership(@"pop_owner_after_transfer", rightItems, destinationNavigationItem,
      sourceNavigationItem, @"right", successResult, NO, YES);
  RNSLogToolbarMorphPopPredicates(navigationController, sharedNavigationController,
      selectedNestedNavigationController, fromViewController, toViewController, selectedTabIndex,
      selectedTabIndex == 0 ? 0 : (selectedTabIndex == 3 ? 3 : (selectedTabIndex == 1 ? 1 : -1)),
      selectedNestedNavigationController.viewControllers.count,
      sharedNavigationController.topViewController == tabsScreenViewController,
      toViewController == tabsScreenViewController,
      selectedNestedNavigationController.viewControllers.count == 1 &&
          toViewController == selectedNestedNavigationController.viewControllers.firstObject,
      isHomeSharedRootPop, isSettingsSharedRootPop, isFinanceSharedRootPop, isSettingsNestedRootPop,
      sourceNavigationItem, destinationNavigationItem,
      [leftItems arrayByAddingObjectsFromArray:rightItems], successResult);`,
    `${PLUGIN_MARKER} pop staging destination items`,
  );
  insertBefore(
    controllerPath,
    '  if (isSettingsOrFinanceSharedRootPop && sourceNavigationItem != destinationNavigationItem) {',
    `  RNSLogToolbarMorphOwnership(@"pop_owner_before_transfer", leftItems, sourceNavigationItem,
      destinationNavigationItem, @"left", successResult, NO, YES);
  RNSLogToolbarMorphOwnership(@"pop_owner_before_transfer", rightItems, sourceNavigationItem,
      destinationNavigationItem, @"right", successResult, NO, YES);`,
    `${PLUGIN_MARKER} pop staging source ownership`,
  );
  insertBefore(
    controllerPath,
    '  if (isSettingsNestedRootPop) {',
    `  if (isSettingsOrFinanceSharedRootPop) {
    RNSLogToolbarMorphOwnership(@"pop_owner_after_source_release", leftItems, sourceNavigationItem,
        destinationNavigationItem, @"left", successResult, NO, YES);
    RNSLogToolbarMorphOwnership(@"pop_owner_after_source_release", rightItems, sourceNavigationItem,
        destinationNavigationItem, @"right", successResult, NO, YES);
  }`,
    `${PLUGIN_MARKER} pop staging ownership after source release`,
  );

  insertBefore(
    controllerPath,
    '    return; // UIKit owns the in-flight morph; native completion reconciles the selected destination.',
    `    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.leftBarButtonItems ?: @[], nil,
        @"left", @"tab_transition_active", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, YES);
    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.rightBarButtonItems ?: @[], nil,
        @"right", @"tab_transition_active", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, YES);`,
    `${PLUGIN_MARKER} coordinator tab transition early return`,
  );

  insertBefore(
    controllerPath,
    '    return; // UIKit owns the in-flight navigation morph; didShow reconciles the destination.',
    `    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.leftBarButtonItems ?: @[], nil,
        @"left", @"navigation_transition_active", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, YES);
    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.rightBarButtonItems ?: @[], nil,
        @"right", @"navigation_transition_active", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, YES);`,
    `${PLUGIN_MARKER} coordinator navigation transition early return`,
  );

  insertBefore(
    controllerPath,
    '    return; // Missing source is not a deliberate empty toolbar.',
    `    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.leftBarButtonItems ?: @[], nil,
        @"left", @"source_unavailable", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.rightBarButtonItems ?: @[], nil,
        @"right", @"source_unavailable", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator source early return`,
  );

  insertAfter(
    controllerPath,
    '      !(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual) &&\n      !isTransitionCompletion;',
    `  RNSLogToolbarMorphItems(@"coordinator_apply_decision", leftItems, sharedLeftItems,
      @"left", reason, RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)
        ? @"same_instances" : @"setter_required", sharedNavigationController.navigationBar,
       shouldAnimateToolbarItemReplacement, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"coordinator_apply_decision", rightItems, sharedRightItems,
      @"right", reason, RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)
        ? @"same_instances" : @"setter_required", sharedNavigationController.navigationBar,
       shouldAnimateToolbarItemReplacement, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator apply decision`,
  );

  const applySetters = `  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)) {
    [sharedNavigationItem setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement];
  }
  if (!RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)) {
    [sharedNavigationItem setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement];
  }`;
  insertAfter(
    controllerPath,
    applySetters,
    `  RNSLogToolbarMorphItems(@"coordinator_apply_result",
      sharedNavigationItem.leftBarButtonItems ?: @[], leftItems, @"left", reason,
      RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)
        ? @"same_instances" : @"setter_completed", sharedNavigationController.navigationBar,
      shouldAnimateToolbarItemReplacement, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"coordinator_apply_result",
      sharedNavigationItem.rightBarButtonItems ?: @[], rightItems, @"right", reason,
      RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)
        ? @"same_instances" : @"setter_completed", sharedNavigationController.navigationBar,
      shouldAnimateToolbarItemReplacement, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator apply result`,
  );

  insertAfter(
    controllerPath,
    '      RNSShouldSkipSharedToolbarExperimentRepairOnce(self, rightItems, reason, &repairReasonRight);',
    `  NSString *attachmentCheckReason = @"attachment_checked";
  if (!canCheckAttachment) {
    if (bar.window == nil) attachmentCheckReason = @"bar_window_missing";
    else if (!isTransitionCompletion && ![self isScreenControllerCurrentlySelected:viewController]) attachmentCheckReason = @"destination_not_selected";
    else if (!isTransitionCompletion && nestedNavigationController.topViewController.viewIfLoaded.window == nil) attachmentCheckReason = @"source_window_missing";
    else attachmentCheckReason = @"replacement_identity_unstable";
  }
  RNSLogToolbarMorphItems(@"attachment_repair_decision", leftItems, sharedLeftItems,
      @"left", repairLeft ? repairReasonLeft : attachmentCheckReason,
      skipAttachmentRepairLeft ? @"ignored" : (repairLeft ? @"will_execute" : (canCheckAttachment ? @"not_needed" : @"ignored")),
      bar, NO, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"attachment_repair_decision", rightItems, sharedRightItems,
      @"right", repairRight ? repairReasonRight : attachmentCheckReason,
      skipAttachmentRepairRight ? @"ignored" : (repairRight ? @"will_execute" : (canCheckAttachment ? @"not_needed" : @"ignored")),
      bar, NO, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} attachment repair decision`,
  );

  insertAfter(
    controllerPath,
    '      [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];',
    `      RNSLogToolbarMorphItems(@"attachment_repair_applied", rightItems, sharedRightItems,
          @"right", repairReasonRight, @"setter_completed", bar, NO,
          self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} attachment repair right result`,
  );
  insertBefore(
    controllerPath,
    '    if (repairRight && !skipAttachmentRepairRight) {',
    `    RNSLogToolbarMorphOwnership(@"attachment_repair_owner_before", rightItems,
        sharedNavigationItem, sourceNavigationItem, @"right", @"before_repair", NO, YES);`,
    `${PLUGIN_MARKER} attachment repair ownership before`,
  );
  insertBefore(
    controllerPath,
    '    if (repairLeft && !skipAttachmentRepairLeft) {',
    `    RNSLogToolbarMorphOwnership(@"attachment_repair_owner_before", leftItems,
        sharedNavigationItem, sourceNavigationItem, @"left", @"before_repair", NO, YES);`,
    `${PLUGIN_MARKER} attachment repair left ownership before`,
  );
  insertAfter(
    controllerPath,
    '      [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];',
    `      RNSLogToolbarMorphOwnership(@"attachment_repair_owner_after", leftItems,
          sharedNavigationItem, sourceNavigationItem, @"left", @"after_repair", NO, YES);`,
    `${PLUGIN_MARKER} attachment repair left ownership after`,
  );
  insertAfter(
    controllerPath,
    '      [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];',
    `      RNSLogToolbarMorphOwnership(@"attachment_repair_owner_after", rightItems,
          sharedNavigationItem, sourceNavigationItem, @"right", @"after_repair", NO, YES);`,
    `${PLUGIN_MARKER} attachment repair right ownership after`,
  );
  insertAfter(
    controllerPath,
    '      [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];',
    `      RNSLogToolbarMorphItems(@"attachment_repair_applied", leftItems, sharedLeftItems,
          @"left", repairReasonLeft, @"setter_completed", bar, NO,
          self.transitionCoordinator != nil || viewController.transitionCoordinator != nil || sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} attachment repair left result`,
  );

  insertBefore(
    controllerPath,
    '  return NO;\n}\n\n#pragma mark - UITabBarControllerDelegate',
    `  NSArray<RNSTabsScreenViewController *> *diagnosticTabs = [self installedScreenControllers];
  UIViewController *diagnosticSourceController = [self effectiveSelectedViewController];
  NSInteger currentTabIndex = (NSInteger)[diagnosticTabs indexOfObject:diagnosticSourceController];
  NSInteger requestedTabIndex = (NSInteger)[diagnosticTabs indexOfObject:viewController];
  if (diagnosticSourceController != viewController) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_requested", @"user",
        self.parentViewController.navigationController, diagnosticSourceController, viewController,
        currentTabIndex, requestedTabIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} tab selection requested`,
  );
  insertAfter(
    controllerPath,
    '  [self userDidSelectViewController:viewController];',
    `  NSArray<RNSTabsScreenViewController *> *diagnosticTabs = [self installedScreenControllers];
  NSInteger selectedTabIndex = (NSInteger)[diagnosticTabs indexOfObject:viewController];
  RNSLogToolbarMorphTabSelection(@"tab_selection_applied", @"user",
      self.parentViewController.navigationController, nil, viewController,
      -1, selectedTabIndex, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil, NO);`,
    `${PLUGIN_MARKER} tab selection applied`,
  );
  insertAfter(
    controllerPath,
    '  [self tabBarController:tabBarController didSelectViewController:selectedTab.viewController];',
    `  UIViewController *diagnosticPreviousTabController = previousTab.viewController;
  UIViewController *diagnosticSelectedTabController = selectedTab.viewController;
  NSArray<RNSTabsScreenViewController *> *diagnosticTabs = [self installedScreenControllers];
  NSInteger diagnosticFromIndex = (NSInteger)[diagnosticTabs indexOfObject:diagnosticPreviousTabController];
  NSInteger diagnosticToIndex = (NSInteger)[diagnosticTabs indexOfObject:diagnosticSelectedTabController];
  UINavigationController *diagnosticNavigationController = self.parentViewController.navigationController;
  RNSLogToolbarMorphTabSelection(@"tab_selection_applied", @"uitab", diagnosticNavigationController,
      diagnosticPreviousTabController, diagnosticSelectedTabController, diagnosticFromIndex,
      diagnosticToIndex, diagnosticNavigationController.transitionCoordinator != nil ||
          self.transitionCoordinator != nil, NO);
  RNSObserveToolbarMorphTabTransition(
      diagnosticNavigationController.transitionCoordinator ?: self.transitionCoordinator,
      @"uitab", diagnosticNavigationController, diagnosticPreviousTabController,
      diagnosticSelectedTabController, diagnosticFromIndex, diagnosticToIndex);`,
    `${PLUGIN_MARKER} UITab source destination and completion`,
  );

  insertAfter(
    controllerPath,
    '- (void)setSelectedIndex:(NSUInteger)selectedIndex\n{',
    `  NSArray<RNSTabsScreenViewController *> *toolbarMorphTabs = [self installedScreenControllers];
  UIViewController *toolbarMorphFrom = [self effectiveSelectedViewController];
  UIViewController *toolbarMorphTo = selectedIndex < toolbarMorphTabs.count ? toolbarMorphTabs[selectedIndex] : nil;
  NSInteger toolbarMorphFromIndex = (NSInteger)[toolbarMorphTabs indexOfObject:toolbarMorphFrom];
  if (toolbarMorphTo != nil && toolbarMorphFrom != toolbarMorphTo) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_requested", @"programmatic-index",
        self.parentViewController.navigationController, toolbarMorphFrom, toolbarMorphTo,
        toolbarMorphFromIndex, (NSInteger)selectedIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} programmatic index selection requested`,
  );
  insertAfter(
    controllerPath,
    '[super setSelectedIndex:selectedIndex];',
    `  if (toolbarMorphTo != nil && toolbarMorphFrom != toolbarMorphTo) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_applied", @"programmatic-index",
        self.parentViewController.navigationController, toolbarMorphFrom, toolbarMorphTo,
        toolbarMorphFromIndex, (NSInteger)selectedIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} programmatic index selection applied`,
  );

  insertAfter(
    controllerPath,
    '- (void)setSelectedViewController:(__kindof UIViewController *)selectedViewController\n{',
    `  UIViewController *toolbarMorphFrom = [self effectiveSelectedViewController];
  NSArray<RNSTabsScreenViewController *> *toolbarMorphTabs = [self installedScreenControllers];
  NSInteger toolbarMorphFromIndex = (NSInteger)[toolbarMorphTabs indexOfObject:toolbarMorphFrom];
  NSInteger toolbarMorphToIndex = (NSInteger)[toolbarMorphTabs indexOfObject:selectedViewController];
  if (selectedViewController != nil && toolbarMorphFrom != selectedViewController) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_requested", @"programmatic-controller",
        self.parentViewController.navigationController, toolbarMorphFrom, selectedViewController,
        toolbarMorphFromIndex, toolbarMorphToIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} programmatic controller selection requested`,
  );
  insertAfter(
    controllerPath,
    '[super setSelectedViewController:selectedViewController];',
    `  if (selectedViewController != nil && toolbarMorphFrom != selectedViewController) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_applied", @"programmatic-controller",
        self.parentViewController.navigationController, toolbarMorphFrom, selectedViewController,
        toolbarMorphFromIndex, toolbarMorphToIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} programmatic controller selection applied`,
  );

  insertAfter(
    controllerPath,
    '- (void)setSelectedTab:(UITab *)selectedTab API_AVAILABLE(ios(18.0))\n{',
    `  UIViewController *toolbarMorphFrom = [self effectiveSelectedViewController];
  UIViewController *toolbarMorphTo = selectedTab.viewController;
  NSArray<RNSTabsScreenViewController *> *toolbarMorphTabs = [self installedScreenControllers];
  NSInteger toolbarMorphFromIndex = (NSInteger)[toolbarMorphTabs indexOfObject:toolbarMorphFrom];
  NSInteger toolbarMorphToIndex = (NSInteger)[toolbarMorphTabs indexOfObject:toolbarMorphTo];
  if (toolbarMorphTo != nil && toolbarMorphFrom != toolbarMorphTo) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_requested", @"programmatic-uitab",
        self.parentViewController.navigationController, toolbarMorphFrom, toolbarMorphTo,
        toolbarMorphFromIndex, toolbarMorphToIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} programmatic UITab selection requested`,
  );
  insertAfter(
    controllerPath,
    '[super setSelectedTab:selectedTab];',
    `  if (toolbarMorphTo != nil && toolbarMorphFrom != toolbarMorphTo) {
    RNSLogToolbarMorphTabSelection(@"tab_selection_applied", @"programmatic-uitab",
        self.parentViewController.navigationController, toolbarMorphFrom, toolbarMorphTo,
        toolbarMorphFromIndex, toolbarMorphToIndex, self.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} programmatic UITab selection applied`,
  );

  const stack = path.join(screensRoot, 'ios', 'RNSScreenStack.mm');
  insertAfter(
    stack,
    '#import "RNSScreenStackHeaderConfig.h"',
    '#import "RNSToolbarMorphDiagnostics.h"',
    `${PLUGIN_MARKER} stack logger import`,
  );
  insertAfter(
    stack,
    '  if ([operation isEqualToString:@"pop"]) {',
    `    if (tabsController != nil) {
      RNSLogToolbarMorphNavigation(@"pop_staging_started", navigationController,
          fromViewController, viewController, operation, @"staging_started", animated,
          navigationController.transitionCoordinator != nil, NO);
    }`,
    `${PLUGIN_MARKER} pop staging start event`,
  );
  insertAfter(
    stack,
    '  // Emporio Rigatti: toolbar pop stage decision complete',
    `  if (tabsController != nil) {
    RNSLogToolbarMorphNavigation(@"navigation_transition_will_show", navigationController,
        fromViewController, viewController, operation, stageResult, animated,
        navigationController.transitionCoordinator != nil, NO);
    if ([operation isEqualToString:@"pop"]) {
      RNSLogToolbarMorphNavigation(@"pop_staging_result", navigationController,
          fromViewController, viewController, operation, stageResult, animated,
          navigationController.transitionCoordinator != nil, NO);
      RNSLogToolbarMorphItems(@"pop_staging_target", viewController.navigationItem.leftBarButtonItems ?: @[], nil,
          @"left", @"navigation-pop-will-show", stageResult, navigationController.navigationBar, NO,
          navigationController.transitionCoordinator != nil);
      RNSLogToolbarMorphItems(@"pop_staging_target", viewController.navigationItem.rightBarButtonItems ?: @[], nil,
          @"right", @"navigation-pop-will-show", stageResult, navigationController.navigationBar, NO,
          navigationController.transitionCoordinator != nil);
      RNSObserveToolbarMorphNavigationTransition(
          navigationController, fromViewController, viewController, operation, animated);
    }
  }`,
    `${PLUGIN_MARKER} pop staging result events`,
  );
  insertAfter(
    stack,
    '  auto *screenView = static_cast<RNSScreenView *>(viewController.view);',
    `  NSArray<UIViewController *> *diagnosticPreviousStack =
      objc_getAssociatedObject(navigationController, &RNSSharedToolbarStableNavigationStackKey);
  UIViewController *diagnosticFromViewController = nil;
  NSString *diagnosticOperation = RNSSharedToolbarNavigationOperation(
      navigationController, diagnosticPreviousStack, viewController, &diagnosticFromViewController);
  RNSTabBarController *diagnosticTabsController =
      RNSFindSharedToolbarTabsController(viewController);
  if (diagnosticTabsController == nil) {
    diagnosticTabsController = RNSFindSharedToolbarTabsController(diagnosticFromViewController);
  }
  UIViewController *diagnosticAncestor = navigationController;
  while (diagnosticAncestor != nil && diagnosticTabsController == nil) {
    diagnosticTabsController = RNSFindSharedToolbarTabsController(diagnosticAncestor);
    diagnosticAncestor = diagnosticAncestor.parentViewController;
  }
  if (diagnosticTabsController != nil) {
    RNSLogToolbarMorphNavigation(@"navigation_will_show_callback", navigationController,
        diagnosticFromViewController, viewController, diagnosticOperation, @"pending", animated,
        navigationController.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} navigation transition start`,
  );
  insertAfter(
    stack,
    '- (void)navigationController:(UINavigationController *)navigationController\n       didShowViewController:(UIViewController *)viewController\n                    animated:(BOOL)animated\n{\n  [self emitOnFinishTransitioningEvent];\n  [RNSScreenWindowTraits updateWindowTraits];',
    `  NSArray<UIViewController *> *previousStableStack =
      objc_getAssociatedObject(navigationController, &RNSSharedToolbarStableNavigationStackKey);
  UIViewController *previousTopViewController = nil;
  NSString *completedOperation = RNSSharedToolbarNavigationOperation(
      navigationController, previousStableStack, viewController, &previousTopViewController);
  RNSTabBarController *diagnosticTabsController =
      RNSFindSharedToolbarTabsController(viewController);
  if (diagnosticTabsController == nil) {
    diagnosticTabsController = RNSFindSharedToolbarTabsController(previousTopViewController);
  }
  UIViewController *diagnosticAncestor = navigationController;
  while (diagnosticAncestor != nil && diagnosticTabsController == nil) {
    diagnosticTabsController = RNSFindSharedToolbarTabsController(diagnosticAncestor);
    diagnosticAncestor = diagnosticAncestor.parentViewController;
  }
  if (diagnosticTabsController != nil) {
    RNSLogToolbarMorphNavigation(@"navigation_transition_did_show", navigationController,
        previousTopViewController, viewController, completedOperation, @"completed", animated,
        navigationController.transitionCoordinator != nil, NO);
  }`,
    `${PLUGIN_MARKER} navigation transition did show`,
  );
}

function patchExpoUIHost(expoUIRoot) {
  const packageInfo = require(path.join(expoUIRoot, 'package.json'));
  if (packageInfo.version !== '58.0.19') {
    throw new Error('Toolbar morph Host diagnostics are anchored to @expo/ui 58.0.19.');
  }

  const hostPath = path.join(expoUIRoot, 'ios', 'HostView.swift');
  insertAfter(
    hostPath,
    'import ExpoModulesCore',
    'import Foundation\nimport os',
    `${PLUGIN_MARKER} Host logger imports`,
  );
  insertAfter(
    hostPath,
    'internal final class HostViewProps: ExpoSwiftUI.ViewProps, ExpoSwiftUI.SafeAreaControllable, ExpoSwiftUI.HostingViewAware {',
    `  @Field var testID: String?
  private var toolbarMorphHostToken: String?
  private var lastToolbarMorphLayout: String?

  func logToolbarMorphHostLifecycle(_ event: String) {
    guard let role = toolbarMorphRole else { return }
    let hostView = hostingView
    installToolbarMorphIdentifierIfNeeded(on: hostView, role: role)
    let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
    logger.info(
      "event=\\(event, privacy: .public) variant=\\(self.toolbarMorphExperimentVariant, privacy: .public) role=\\(role, privacy: .public) host=\\(self.toolbarMorphToken, privacy: .public) uptime_ms=\\(uptimeMilliseconds, privacy: .public) window=\\(hostView?.window != nil, privacy: .public) attached=\\(hostView?.superview != nil, privacy: .public) hidden=\\(hostView?.isHidden ?? false, privacy: .public) alpha_milli=\\(Int(((hostView?.alpha ?? 0) * 1_000).rounded()), privacy: .public)"
    )
  }

  func prepareToolbarMorphHostIdentity() {
    guard let role = toolbarMorphRole else { return }
    installToolbarMorphIdentifierIfNeeded(on: hostingView, role: role)
  }

  func logToolbarMorphHostLayout(_ size: CGSize) {
    guard let role = toolbarMorphRole else { return }
    let width = Int(size.width.rounded())
    let height = Int(size.height.rounded())
    let layout = "\\(width)x\\(height)"
    guard layout != lastToolbarMorphLayout else { return }
    lastToolbarMorphLayout = layout
    let hostView = hostingView
    installToolbarMorphIdentifierIfNeeded(on: hostView, role: role)
    let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
    logger.info(
      "event=host_layout variant=\\(self.toolbarMorphExperimentVariant, privacy: .public) role=\\(role, privacy: .public) host=\\(self.toolbarMorphToken, privacy: .public) uptime_ms=\\(uptimeMilliseconds, privacy: .public) width=\\(width, privacy: .public) height=\\(height, privacy: .public) available=\\(width > 0 && height > 0, privacy: .public) window=\\(hostView?.window != nil, privacy: .public) attached=\\(hostView?.superview != nil, privacy: .public) hidden=\\(hostView?.isHidden ?? false, privacy: .public) alpha_milli=\\(Int(((hostView?.alpha ?? 0) * 1_000).rounded()), privacy: .public)"
    )
  }

  private var toolbarMorphExperimentVariant: String {
    let configuredVariant = Bundle.main.infoDictionary?[\"EmporioToolbarMorphExperimentVariant\"] as? String
    return configuredVariant == \"B\" ? \"B\" : \"A\"
  }

  private var toolbarMorphRole: String? {
    guard let testID else { return nil }
    switch testID {
    case "toolbar-morph:home-search": return "home-search"
    case "toolbar-morph:settings-profile": return "settings-profile"
    default: return nil
    }
  }

  private var toolbarMorphToken: String {
    if toolbarMorphHostToken == nil {
      toolbarMorphHostToken = "host-\\(UUID().uuidString.lowercased())"
    }
    return toolbarMorphHostToken ?? "host-unavailable"
  }

  private func installToolbarMorphIdentifierIfNeeded(on view: UIView?, role: String) {
    guard let view, view.accessibilityIdentifier == nil else { return }
    view.accessibilityIdentifier = "toolbar-morph:\\(role)"
  }

  private let logger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",
    category: "ToolbarMorphDiagnostics"
  )`,
    `${PLUGIN_MARKER} Host props diagnostics`,
  );
  insertAfter(
    hostPath,
    '      .coordinateSpace(name: expoHostCoordinateSpace)',
    `      .onAppear { props.logToolbarMorphHostLifecycle("host_appeared") }
      .onDisappear { props.logToolbarMorphHostLifecycle("host_disappeared") }`,
    `${PLUGIN_MARKER} Host lifecycle events current`,
  );
  insertBefore(
    hostPath,
    '      .coordinateSpace(name: expoHostCoordinateSpace)\n    }\n  }\n\n}',
    `      .onAppear { props.logToolbarMorphHostLifecycle("host_appeared") }
      .onDisappear { props.logToolbarMorphHostLifecycle("host_disappeared") }
`,
    `${PLUGIN_MARKER} Host lifecycle events legacy`,
  );
  insertAfter(
    hostPath,
    '  var body: some View {',
    '    let _ = props.prepareToolbarMorphHostIdentity()',
    `${PLUGIN_MARKER} Host identity preparation`,
  );
  insertAfter(
    hostPath,
    '  private func dispatchOnLayoutContent(_ size: CGSize) {',
    '    props.logToolbarMorphHostLayout(size)',
    `${PLUGIN_MARKER} Host native layout event`,
  );
}

function patchToolbarMorphDiagnostics(options = {}) {
  const screensRoot =
    options.screensRoot ?? path.dirname(require.resolve('react-native-screens/package.json'));
  const expoUIRoot = options.expoUIRoot ?? path.dirname(require.resolve('@expo/ui/package.json'));
  patchScreens(screensRoot);
  patchExpoUIHost(expoUIRoot);
}

function withToolbarMorphDiagnostics(config) {
  return withDangerousMod(config, [
    'ios',
    (configWithMod) => {
      const projectRoot = configWithMod.modRequest.projectRoot;
      patchToolbarMorphDiagnostics({
        screensRoot: path.join(projectRoot, 'node_modules', 'react-native-screens'),
        expoUIRoot: path.join(projectRoot, 'node_modules', '@expo', 'ui'),
      });
      return configWithMod;
    },
  ]);
}

const withToolbarMorphDiagnosticsPlugin = createRunOncePlugin(
  withToolbarMorphDiagnostics,
  'with-toolbar-morph-diagnostics',
  '0.1.0',
);

Object.defineProperty(withToolbarMorphDiagnosticsPlugin, '__patchToolbarMorphDiagnosticsForTests', {
  value: patchToolbarMorphDiagnostics,
});

module.exports = withToolbarMorphDiagnosticsPlugin;
