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

static char RNSToolbarMorphNavigationItemTokenKey;
static char RNSToolbarMorphItemTokenKey;
static char RNSToolbarMorphTabIndexKey;
static char RNSToolbarMorphPhaseKey;
static char RNSToolbarMorphOperationKey;
static char RNSToolbarMorphTransitionActiveKey;
static char RNSToolbarMorphPreviousWindowAttachedKey;
static char RNSToolbarMorphPreviousWindowTokenKey;
static char RNSToolbarMorphPreviousSuperviewTokenKey;
static char RNSToolbarMorphRoleKey;
static NSString * const RNSToolbarMorphOperationStackKey = @"com.pareact.ToolbarMorphDiagnostics.operationStack";

static inline BOOL RNSIsToolbarMorphDiagnosticsEnabled(void)
{
#if DEBUG
  return YES;
#else
  id enabled = NSBundle.mainBundle.infoDictionary[@"EmporioToolbarMorphDiagnosticsEnabled"];
  return [enabled respondsToSelector:@selector(boolValue)] && [enabled boolValue];
#endif
}

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
  id rememberedRole = objc_getAssociatedObject(item, &RNSToolbarMorphRoleKey);
  if ([rememberedRole isKindOfClass:[NSString class]]) return rememberedRole;
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

static inline id RNSBeginToolbarMorphDiagnosticOperation(NSString *operation, NSString *phase)
{
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return nil;
  NSMutableDictionary *threadDictionary = NSThread.currentThread.threadDictionary;
  NSMutableArray<NSDictionary<NSString *, NSString *> *> *stack =
      threadDictionary[RNSToolbarMorphOperationStackKey];
  if (stack == nil) {
    stack = [NSMutableArray new];
    threadDictionary[RNSToolbarMorphOperationStackKey] = stack;
  }
  [stack addObject:@{ @"operation": operation ?: @"other", @"phase": phase ?: @"unknown" }];
  return stack;
}

static inline void RNSEndToolbarMorphDiagnosticOperation(id operationStack)
{
  if (!RNSIsToolbarMorphDiagnosticsEnabled() || operationStack == nil) return;
  NSMutableArray<NSDictionary<NSString *, NSString *> *> *stack = operationStack;
  if (stack.count > 0) [stack removeLastObject];
  if (stack.count == 0) {
    [NSThread.currentThread.threadDictionary removeObjectForKey:RNSToolbarMorphOperationStackKey];
  }
}

static inline NSString *RNSCurrentToolbarMorphDiagnosticValue(NSString *key, NSString *fallback)
{
  NSArray<NSDictionary<NSString *, NSString *> *> *stack =
      NSThread.currentThread.threadDictionary[RNSToolbarMorphOperationStackKey];
  return stack.lastObject[key] ?: fallback;
}

static inline NSString *RNSToolbarMorphContextString(id object, const void *key, NSString *fallback)
{
  id value = object != nil ? objc_getAssociatedObject(object, key) : nil;
  return [value isKindOfClass:[NSString class]] ? value : fallback;
}

static inline NSInteger RNSToolbarMorphContextInteger(id object, const void *key, NSInteger fallback)
{
  id value = object != nil ? objc_getAssociatedObject(object, key) : nil;
  return [value respondsToSelector:@selector(integerValue)] ? [value integerValue] : fallback;
}

static inline void RNSAssociateToolbarMorphContextWithView(
    UIView *view,
    NSString *itemToken,
    NSString *navigationItemToken,
    NSInteger tabIndex,
    NSString *phase,
    NSString *operation,
    BOOL transitionActive,
    NSUInteger depth)
{
  if (view == nil || depth > 8) return;
  if (itemToken != nil) objc_setAssociatedObject(view, &RNSToolbarMorphItemTokenKey, itemToken, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (navigationItemToken != nil) objc_setAssociatedObject(view, &RNSToolbarMorphNavigationItemTokenKey, navigationItemToken, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (tabIndex >= 0) objc_setAssociatedObject(view, &RNSToolbarMorphTabIndexKey, @(tabIndex), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (phase != nil) objc_setAssociatedObject(view, &RNSToolbarMorphPhaseKey, phase, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (operation != nil) objc_setAssociatedObject(view, &RNSToolbarMorphOperationKey, operation, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  objc_setAssociatedObject(view, &RNSToolbarMorphTransitionActiveKey, @(transitionActive), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  for (UIView *child in view.subviews) {
    RNSAssociateToolbarMorphContextWithView(child, itemToken, navigationItemToken, tabIndex,
        phase, operation, transitionActive, depth + 1);
  }
}

static inline void RNSAssociateToolbarMorphItemContext(
    UIBarButtonItem *item,
    UINavigationItem *owner,
    NSInteger tabIndex,
    NSString *phase,
    NSString *operation,
    BOOL transitionActive)
{
  if (item == nil) return;
  NSString *itemToken = RNSToolbarMorphToken(item, @"item");
  NSString *role = RNSRoleForToolbarMorphItem(item);
  if (role != nil) objc_setAssociatedObject(item, &RNSToolbarMorphRoleKey, role, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  NSString *navigationItemToken = owner != nil ? RNSToolbarMorphToken(owner, @"navigation_item") : nil;
  if (navigationItemToken != nil) objc_setAssociatedObject(item, &RNSToolbarMorphNavigationItemTokenKey, navigationItemToken, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (tabIndex >= 0) objc_setAssociatedObject(item, &RNSToolbarMorphTabIndexKey, @(tabIndex), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (phase != nil) objc_setAssociatedObject(item, &RNSToolbarMorphPhaseKey, phase, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  if (operation != nil) objc_setAssociatedObject(item, &RNSToolbarMorphOperationKey, operation, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  objc_setAssociatedObject(item, &RNSToolbarMorphTransitionActiveKey, @(transitionActive), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  RNSAssociateToolbarMorphContextWithView(item.customView, itemToken, navigationItemToken,
      tabIndex, phase, operation, transitionActive, 0);
}

static inline NSInteger RNSResolveToolbarMorphTabIndex(UIViewController *viewController)
{
  UIViewController *candidate = viewController;
  while (candidate != nil) {
    if ([candidate isKindOfClass:[UITabBarController class]]) {
      return ((UITabBarController *)candidate).selectedIndex;
    }
    candidate = candidate.parentViewController;
  }
  return viewController.tabBarController != nil ? viewController.tabBarController.selectedIndex : -1;
}

static inline NSString *RNSRoleForToolbarMorphIdentifier(NSString *identifier);

static inline UIView *RNSFindToolbarMorphAccessoryView(UIView *view, NSString *role, NSUInteger depth)
{
  if (view == nil || depth > 8) return nil;
  if ([RNSRoleForToolbarMorphIdentifier(view.accessibilityIdentifier) isEqualToString:role]) return view;
  for (UIView *child in view.subviews) {
    UIView *match = RNSFindToolbarMorphAccessoryView(child, role, depth + 1);
    if (match != nil) return match;
  }
  return nil;
}

static inline BOOL RNSToolbarMorphArrayContainsItem(NSArray<UIBarButtonItem *> *items, UIBarButtonItem *candidate)
{
  for (UIBarButtonItem *item in items ?: @[]) if (item == candidate) return YES;
  return NO;
}

static inline BOOL RNSToolbarMorphOwnerContainsItem(UINavigationItem *owner, UIBarButtonItem *candidate);

static inline NSString *RNSSafeToolbarMorphReason(NSString *reason)
{
  NSArray<NSString *> *allowed = @[
    @"header_materialization", @"header_subview_invalidated", @"materialization",
    @"tab-selection-index", @"programmatic-selection", @"tab-selection-shouldSelect",
    @"container-resync", @"header-materialization/resync", @"navigation-did-show",
    @"tab-transition-completion",
    @"tab_transition_active", @"navigation_transition_active",
    @"detached_custom_view", @"already_attached_or_not_repairable", @"bar_window_missing",
    @"destination_not_selected", @"source_window_missing", @"replacement_identity_unstable",
    @"attachment_checked",
    @"transition_active", @"source_unavailable", @"same_instances", @"setter_completed",
    @"experiment_b_skip_once", @"experiment_b_recovery", @"experiment_b_shared_side_preserved",
    @"initial_materialization", @"navigation-pop-will-show", @"pop_staging_predicates",
    @"pop_owner_before_transfer", @"pop_owner_after_source_release", @"pop_owner_after_transfer",
    @"coordinator_capture_owner_before",
    @"coordinator_capture_owner_after", @"coordinator_apply_owner_before", @"coordinator_apply_owner_after",
    @"attachment_repair_owner_before", @"attachment_repair_owner_after", @"fabric_snapshot"
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
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
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  RNSAssociateToolbarMorphItemContext(item, nil,
      RNSToolbarMorphContextInteger(item, &RNSToolbarMorphTabIndexKey, -1), reason, event,
      transitionActive);
  NSString *operation = RNSCurrentToolbarMorphDiagnosticValue(@"operation",
      RNSToolbarMorphContextString(item, &RNSToolbarMorphOperationKey, @"none"));
  NSString *phase = RNSCurrentToolbarMorphDiagnosticValue(@"phase",
      RNSToolbarMorphContextString(item, &RNSToolbarMorphPhaseKey, @"unknown"));

  os_log_with_type(
      RNSCreateToolbarMorphDiagnosticsLogger(),
      OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=%{public}@ item=%{public}@ counterpart=%{public}@ same_instance=%{public}ld custom_view=%{public}@ side=%{public}@ reason=%{public}@ result=%{public}@ uptime_ms=%{public}llu item_class=%{public}@ custom_class=%{public}@ custom_available=%{public}d window=%{public}d bar_window=%{public}d same_window=%{public}d attached=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}ld alpha_milli=%{public}ld animated=%{public}d transition_active=%{public}d operation=%{public}@ phase=%{public}@ pid=%{public}d navigation_item=%{public}@ tab_index=%{public}ld parent=%{public}@ window_id=%{public}@",
      event, RNSCurrentToolbarMorphExperimentVariant(), role, itemToken, counterpartToken, (long)sameInstance, customToken, side,
      RNSSafeToolbarMorphReason(reason), result, uptimeMilliseconds, itemClass, customClass,
      customView != nil, viewWindow != nil, barWindow != nil, sameWindow, attached,
      (long)width, (long)height, (long)hidden, (long)alphaMilli, animated, transitionActive,
      operation, phase, processIdentifier,
      RNSToolbarMorphContextString(item, &RNSToolbarMorphNavigationItemTokenKey, @"none"),
      (long)RNSToolbarMorphContextInteger(item, &RNSToolbarMorphTabIndexKey, -1),
      RNSToolbarMorphToken(customView.superview, @"view"), RNSToolbarMorphToken(viewWindow, @"window"));
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

static inline void RNSLogToolbarMorphNavigationItemMutation(
    NSString *event,
    NSString *operation,
    NSString *phase,
    NSString *side,
    UINavigationItem *owner,
    NSArray<UIBarButtonItem *> *beforeItems,
    NSArray<UIBarButtonItem *> *observedItems,
    UIViewController *viewController,
    UINavigationController *navigationController,
    BOOL animated)
{
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  NSInteger tabIndex = RNSResolveToolbarMorphTabIndex(viewController);
  BOOL transitionActive = viewController.transitionCoordinator != nil ||
      navigationController.transitionCoordinator != nil;
  NSArray<UIBarButtonItem *> *currentItems = [side isEqualToString:@"left"]
      ? (owner.leftBarButtonItems ?: @[]) : (owner.rightBarButtonItems ?: @[]);
  NSMutableArray<UIBarButtonItem *> *trackedItems = [NSMutableArray new];
  for (NSArray<UIBarButtonItem *> *items in @[beforeItems ?: @[], observedItems ?: @[], currentItems]) {
    for (UIBarButtonItem *item in items) {
      if (item != nil && !RNSToolbarMorphArrayContainsItem(trackedItems, item)) [trackedItems addObject:item];
    }
  }

  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  NSString *navigationItemToken = RNSToolbarMorphToken(owner, @"navigation_item");
  for (UIBarButtonItem *item in trackedItems) {
    NSString *role = RNSRoleForToolbarMorphItem(item);
    if (role == nil) continue;
    RNSAssociateToolbarMorphItemContext(item, owner, tabIndex, phase, operation, transitionActive);
    UIView *customView = item.customView;
    UIView *accessoryView = RNSFindToolbarMorphAccessoryView(customView, role, 0) ?: customView;
    UIWindow *customWindow = customView.window;
    UIWindow *accessoryWindow = accessoryView.window;
    NSArray<UIBarButtonItem *> *beforeOnSide = beforeItems ?: @[];
    NSArray<UIBarButtonItem *> *observedOnSide = observedItems ?: @[];
    os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
        "event=%{public}@ variant=%{public}@ role=%{public}@ pid=%{public}d uptime_ms=%{public}llu operation=%{public}@ phase=%{public}@ side=%{public}@ navigation=%{public}@ navigation_item=%{public}@ controller=%{public}@ tab_index=%{public}ld transition_active=%{public}d animated=%{public}d item=%{public}@ custom_view=%{public}@ custom_parent=%{public}@ custom_window=%{public}@ accessory_view=%{public}@ accessory_parent=%{public}@ accessory_window=%{public}@ before_contains=%{public}d observed_contains=%{public}d owner_contains=%{public}d before_count=%{public}ld observed_count=%{public}ld current_count=%{public}ld width=%{public}ld height=%{public}ld hidden=%{public}d alpha_milli=%{public}ld",
        event, RNSCurrentToolbarMorphExperimentVariant(), role, processIdentifier, uptimeMilliseconds,
        operation, phase, side, RNSToolbarMorphToken(navigationController, @"navigation"),
        navigationItemToken, RNSToolbarMorphToken(viewController, @"controller"), (long)tabIndex,
        transitionActive, animated, RNSToolbarMorphToken(item, @"item"),
        RNSToolbarMorphToken(customView, @"view"), RNSToolbarMorphToken(customView.superview, @"view"),
        RNSToolbarMorphToken(customWindow, @"window"), RNSToolbarMorphToken(accessoryView, @"view"),
        RNSToolbarMorphToken(accessoryView.superview, @"view"), RNSToolbarMorphToken(accessoryWindow, @"window"),
        RNSToolbarMorphArrayContainsItem(beforeOnSide, item),
        RNSToolbarMorphArrayContainsItem(observedOnSide, item),
        RNSToolbarMorphOwnerContainsItem(owner, item), (long)beforeOnSide.count,
        (long)observedOnSide.count, (long)currentItems.count,
        (long)(customView != nil ? lrint(customView.bounds.size.width) : -1),
        (long)(customView != nil ? lrint(customView.bounds.size.height) : -1),
        customView.hidden, (long)(customView != nil ? lrint(customView.alpha * 1000.0) : -1));
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  os_log_with_type(
      RNSCreateToolbarMorphDiagnosticsLogger(),
      OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=coordinator source=%{public}@ from_index=%{public}ld to_index=%{public}ld uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d cancelled=%{public}d pid=%{public}d",
      event, RNSCurrentToolbarMorphExperimentVariant(), source, (long)fromIndex, (long)toIndex, uptimeMilliseconds, animated, transitionActive, cancelled, processIdentifier);
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  os_log_with_type(
      RNSCreateToolbarMorphDiagnosticsLogger(),
      OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=coordinator navigation=%{public}@ from=%{public}@ to=%{public}@ operation=%{public}@ result=%{public}@ stack_depth=%{public}ld uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d cancelled=%{public}d pid=%{public}d",
      event, RNSCurrentToolbarMorphExperimentVariant(), navigationToken, fromToken, toToken,
      RNSSafeToolbarMorphOperation(operation), RNSSafeToolbarMorphStageResult(result),
      (long)stackDepth, uptimeMilliseconds, animated, transitionActive, cancelled, processIdentifier);
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  if (items.count == 0) {
    os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
        "event=%{public}@ variant=%{public}@ role=coordinator item=none side=%{public}@ owner=%{public}@ other_owner=%{public}@ result=%{public}@ uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d pid=%{public}d operation=ownership phase=%{public}@",
        event, RNSCurrentToolbarMorphExperimentVariant(), side,
        RNSToolbarMorphToken(owner, @"navigation_item"), RNSToolbarMorphToken(otherOwner, @"navigation_item"),
        result, uptimeMilliseconds, animated, transitionActive, processIdentifier, event);
    return;
  }
  for (UIBarButtonItem *item in items) {
    NSString *role = RNSRoleForToolbarMorphItem(item);
    if (role == nil) continue;
    UIView *customView = item.customView;
    RNSAssociateToolbarMorphItemContext(item, owner, -1, event, @"ownership", transitionActive);
    os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
        "event=%{public}@ variant=%{public}@ role=%{public}@ item=%{public}@ custom_view=%{public}@ side=%{public}@ owner=%{public}@ other_owner=%{public}@ owner_contains=%{public}d other_owner_contains=%{public}d attached=%{public}d window=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}d alpha_milli=%{public}ld result=%{public}@ uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d pid=%{public}d operation=ownership phase=%{public}@ custom_parent=%{public}@ window_id=%{public}@",
        event, RNSCurrentToolbarMorphExperimentVariant(), role, RNSToolbarMorphToken(item, @"item"),
        RNSToolbarMorphToken(customView, @"view"), side,
        RNSToolbarMorphToken(owner, @"navigation_item"), RNSToolbarMorphToken(otherOwner, @"navigation_item"),
        RNSToolbarMorphOwnerContainsItem(owner, item), RNSToolbarMorphOwnerContainsItem(otherOwner, item),
        customView != nil && customView.superview != nil, customView.window != nil,
        (long)(customView != nil ? lrint(customView.bounds.size.width) : -1),
        (long)(customView != nil ? lrint(customView.bounds.size.height) : -1),
        customView.hidden, (long)(customView != nil ? lrint(customView.alpha * 1000.0) : -1),
        result, uptimeMilliseconds, animated, transitionActive, processIdentifier, event,
        RNSToolbarMorphToken(customView.superview, @"view"), RNSToolbarMorphToken(customView.window, @"window"));
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  NSString *target = selectedTabIndex == 0 ? @"home" :
      (selectedTabIndex == 3 ? @"settings" : (selectedTabIndex == 1 ? @"finance" : @"other"));
  NSString *role = RNSRoleForToolbarMorphItems(items);
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=pop_staging_predicates variant=%{public}@ role=%{public}@ target=%{public}@ navigation=%{public}@ expected_navigation=%{public}@ navigation_matches_shared=%{public}d expected_nested_navigation=%{public}@ navigation_matches_selected_nested=%{public}d from=%{public}@ to=%{public}@ shared_tabs_controller_is_top=%{public}d destination_is_tabs_root=%{public}d selected_tab_index=%{public}ld expected_tab_index=%{public}ld stack_depth=%{public}ld nested_stack_depth=%{public}ld destination_is_nested_root=%{public}d home_root_predicate=%{public}d settings_shared_root_predicate=%{public}d finance_shared_root_predicate=%{public}d settings_nested_root_predicate=%{public}d source_owner=%{public}@ destination_owner=%{public}@ result=%{public}@ uptime_ms=%{public}llu transition_active=%{public}d pid=%{public}d operation=pop-stage phase=predicate-evaluation",
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
      navigationController.transitionCoordinator != nil, processIdentifier);
}

static inline NSString *RNSSafeToolbarMorphCallStack(void)
{
  NSMutableArray<NSString *> *frames = [NSMutableArray new];
  NSRegularExpression *addressPattern = [NSRegularExpression
      regularExpressionWithPattern:@"0x[0-9a-fA-F]+\\\\s+(.+?)(?:\\\\s+\\\\+\\\\s+\\\\d+)?$"
      options:0 error:nil];
  for (NSString *symbol in NSThread.callStackSymbols) {
    if (frames.count >= 12) break;
    NSTextCheckingResult *match = [addressPattern firstMatchInString:symbol options:0
        range:NSMakeRange(0, symbol.length)];
    if (match.numberOfRanges < 2) continue;
    NSString *frame = [symbol substringWithRange:[match rangeAtIndex:1]];
    if ([frame containsString:@"/"] || [frame containsString:@"\\\\"] || frame.length == 0) continue;
    [frames addObject:frame];
  }
  return [frames componentsJoinedByString:@" <- "];
}

static inline void RNSLogToolbarMorphViewLifecycle(
    NSString *event,
    UIView *view,
    UIView *targetSuperview,
    UIBarButtonItem *item,
    NSString *previousWindowToken,
    UIWindow *targetWindow,
    NSString *operation,
    NSString *phase)
{
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  NSString *role = RNSRoleForToolbarMorphItem(item) ?: RNSFindToolbarMorphRoleInView(view, 0);
  if (role == nil) return;
  UIWindow *window = view.window;
  UIView *customView = item.customView;
  NSString *navigationItemToken = RNSToolbarMorphContextString(item, &RNSToolbarMorphNavigationItemTokenKey,
      RNSToolbarMorphContextString(view, &RNSToolbarMorphNavigationItemTokenKey, @"none"));
  NSInteger tabIndex = RNSToolbarMorphContextInteger(item, &RNSToolbarMorphTabIndexKey,
      RNSToolbarMorphContextInteger(view, &RNSToolbarMorphTabIndexKey, -1));
  NSString *contextOperation = RNSCurrentToolbarMorphDiagnosticValue(@"operation",
      RNSToolbarMorphContextString(item, &RNSToolbarMorphOperationKey,
          RNSToolbarMorphContextString(view, &RNSToolbarMorphOperationKey, @"none")));
  NSString *contextPhase = RNSCurrentToolbarMorphDiagnosticValue(@"phase",
      RNSToolbarMorphContextString(item, &RNSToolbarMorphPhaseKey,
          RNSToolbarMorphContextString(view, &RNSToolbarMorphPhaseKey, @"lifecycle")));
  NSString *oldSuperviewToken = RNSToolbarMorphContextString(view, &RNSToolbarMorphPreviousSuperviewTokenKey, @"none");
  BOOL contextTransitionActive = [objc_getAssociatedObject(item, &RNSToolbarMorphTransitionActiveKey) boolValue] ||
      [objc_getAssociatedObject(view, &RNSToolbarMorphTransitionActiveKey) boolValue];
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=%{public}@ pid=%{public}d uptime_ms=%{public}llu operation=%{public}@ phase=%{public}@ item=%{public}@ custom_view=%{public}@ navigation_item=%{public}@ tab_index=%{public}ld transition_active=%{public}d view=%{public}@ previous_superview=%{public}@ superview=%{public}@ target_superview=%{public}@ previous_window=%{public}@ window=%{public}@ target_window=%{public}@ attached=%{public}d custom_attached=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}d alpha_milli=%{public}ld",
      event, RNSCurrentToolbarMorphExperimentVariant(), role,
      processIdentifier, uptimeMilliseconds, operation ?: contextOperation, phase ?: contextPhase,
      RNSToolbarMorphToken(item, @"item"), RNSToolbarMorphToken(customView, @"view"),
      navigationItemToken, (long)tabIndex, contextTransitionActive, RNSToolbarMorphToken(view, @"view"), oldSuperviewToken,
      RNSToolbarMorphToken(view.superview, @"view"), RNSToolbarMorphToken(targetSuperview, @"view"),
      previousWindowToken ?: @"none", RNSToolbarMorphToken(window, @"window"),
      RNSToolbarMorphToken(targetWindow, @"window"), view.superview != nil && window != nil,
      customView.superview != nil && customView.window != nil,
      (long)lrint(view.bounds.size.width), (long)lrint(view.bounds.size.height), view.hidden,
      (long)lrint(view.alpha * 1000.0));
}

static inline void RNSLogToolbarMorphAttachmentLoss(UIView *view, UIBarButtonItem *item, NSString *previousWindowToken)
{
  if (!RNSIsToolbarMorphDiagnosticsEnabled() || view.window != nil) return;
  NSString *role = RNSRoleForToolbarMorphItem(item) ?: RNSFindToolbarMorphRoleInView(view, 0);
  if (role == nil) return;
  NSString *operation = RNSCurrentToolbarMorphDiagnosticValue(@"operation",
      RNSToolbarMorphContextString(item, &RNSToolbarMorphOperationKey, @"none"));
  NSString *phase = RNSCurrentToolbarMorphDiagnosticValue(@"phase",
      RNSToolbarMorphContextString(item, &RNSToolbarMorphPhaseKey, @"window-detach"));
  NSString *navigationItemToken = RNSToolbarMorphContextString(item, &RNSToolbarMorphNavigationItemTokenKey, @"none");
  NSInteger tabIndex = RNSToolbarMorphContextInteger(item, &RNSToolbarMorphTabIndexKey, -1);
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  NSString *callStack = RNSSafeToolbarMorphCallStack();
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=custom_view_attachment_lost variant=%{public}@ role=%{public}@ pid=%{public}d uptime_ms=%{public}llu operation=%{public}@ phase=%{public}@ item=%{public}@ custom_view=%{public}@ navigation_item=%{public}@ tab_index=%{public}ld view=%{public}@ parent=%{public}@ previous_window=%{public}@ custom_window=%{public}@ call_stack=%{public}@",
      RNSCurrentToolbarMorphExperimentVariant(), role, processIdentifier, uptimeMilliseconds,
      operation, phase, RNSToolbarMorphToken(item, @"item"), RNSToolbarMorphToken(item.customView, @"view"),
      navigationItemToken, (long)tabIndex, RNSToolbarMorphToken(view, @"view"),
      RNSToolbarMorphToken(view.superview, @"view"), previousWindowToken ?: @"none",
      RNSToolbarMorphToken(item.customView.window, @"window"), callStack);
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
  uint64_t uptimeMilliseconds = (uint64_t)(NSProcessInfo.processInfo.systemUptime * 1000.0);
  int processIdentifier = (int)NSProcessInfo.processInfo.processIdentifier;
  os_log_with_type(RNSCreateToolbarMorphDiagnosticsLogger(), OS_LOG_TYPE_INFO,
      "event=%{public}@ variant=%{public}@ role=coordinator source=%{public}@ navigation=%{public}@ from=%{public}@ to=%{public}@ from_index=%{public}ld to_index=%{public}ld transition_active=%{public}d cancelled=%{public}d uptime_ms=%{public}llu pid=%{public}d",
      event, RNSCurrentToolbarMorphExperimentVariant(), source,
      RNSToolbarMorphToken(navigationController, @"navigation"),
      RNSToolbarMorphToken(fromViewController, @"controller"),
      RNSToolbarMorphToken(toViewController, @"controller"), (long)fromIndex, (long)toIndex,
      transitionActive, cancelled, uptimeMilliseconds, processIdentifier);
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
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
  if (!RNSIsToolbarMorphDiagnosticsEnabled()) return;
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

function objectiveCMethodNameAt(contents, sourceIndex) {
  const prefix = contents.slice(0, sourceIndex);
  const methodStart = Math.max(prefix.lastIndexOf('\n- ('), prefix.lastIndexOf('\n+ ('));
  if (methodStart < 0) return 'unknown-method';
  const methodBodyStart = contents.indexOf('\n{', methodStart);
  const signature = contents.slice(
    methodStart,
    methodBodyStart < 0 ? sourceIndex : methodBodyStart,
  );
  return signature.match(/[-+]\s*\([^)]*\)\s*([A-Za-z_][A-Za-z0-9_]*)/)?.[1] ?? 'unknown-method';
}

function instrumentObjectiveCNavigationItemSetters(filePath, fileLabel) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const callPattern = /^([ \t]*)\[(\w+) set(Left|Right)BarButtonItems:([\s\S]*?);[ \t]*$/gm;
  let match;
  const edits = [];
  const methodCounts = new Map();

  while ((match = callPattern.exec(contents)) !== null) {
    const [statement, indentation, owner, sideName] = match;
    const side = sideName.toLowerCase();
    const method = objectiveCMethodNameAt(contents, match.index);
    const countKey = `${method}:${owner}:${side}`;
    const ordinal = (methodCounts.get(countKey) ?? 0) + 1;
    methodCounts.set(countKey, ordinal);
    const operation = `${fileLabel}-${method}-${owner}-set-${side}`;
    const marker = `${PLUGIN_MARKER} setter ${method} ${owner} ${side} ${ordinal}`;
    if (contents.includes(marker)) continue;

    const suffix = `${fileLabel.replace(/[^A-Za-z0-9]/g, '')}${method.replace(/[^A-Za-z0-9]/g, '')}${side}${ordinal}`;
    const beforeItems = `rnsToolbarMorphBefore${suffix}`;
    const context = `rnsToolbarMorphContext${suffix}`;
    const enabled = `rnsToolbarMorphEnabled${suffix}`;
    const viewController = fileLabel === 'header-config' ? 'vc' : 'self';
    const navigationController =
      fileLabel === 'header-config'
        ? '((UINavigationController *)vc.parentViewController)'
        : 'self.parentViewController.navigationController';
    const before = `${indentation}// ${marker}\n${indentation}BOOL ${enabled} = RNSIsToolbarMorphDiagnosticsEnabled();\n${indentation}NSArray<UIBarButtonItem *> *${beforeItems} = ${enabled} ? (${owner}.${side}BarButtonItems ?: @[]) : @[];\n${indentation}id ${context} = RNSBeginToolbarMorphDiagnosticOperation(@"${operation}", @"${method}");\n${indentation}if (${enabled}) RNSLogToolbarMorphNavigationItemMutation(@"navigation_item_setter", @"${operation}", @"before", @"${side}", ${owner}, ${beforeItems}, ${beforeItems}, ${viewController}, ${navigationController}, NO);\n`;
    const animatedExpression =
      statement.match(/animated:([A-Za-z_][A-Za-z0-9_]*|YES|NO)/)?.[1] ?? 'NO';
    const after = `\n${indentation}if (${enabled}) RNSLogToolbarMorphNavigationItemMutation(@"navigation_item_setter", @"${operation}", @"after", @"${side}", ${owner}, ${beforeItems}, ${owner}.${side}BarButtonItems ?: @[], ${viewController}, ${navigationController}, ${animatedExpression});\n${indentation}RNSEndToolbarMorphDiagnosticOperation(${context});`;
    edits.push({
      start: match.index,
      end: match.index + statement.length,
      replacement: `${before}${statement}${after}`,
    });
  }

  if (edits.length === 0) return;
  let patched = contents;
  for (const edit of edits.reverse()) {
    patched = `${patched.slice(0, edit.start)}${edit.replacement}${patched.slice(edit.end)}`;
  }
  fs.writeFileSync(filePath, patched);
}

function instrumentHeaderConfigPropertySetters(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const methodStart = contents.indexOf('+ (void)updateViewController:(UIViewController *)vc');
  if (methodStart < 0) {
    throw new Error(`Could not apply ${PLUGIN_MARKER}: updateViewController method was not found.`);
  }
  const nextMethod = contents.slice(methodStart + 1).search(/\n[-+]\s*\(/);
  const methodEnd = nextMethod < 0 ? contents.length : methodStart + 1 + nextMethod;
  const methodSource = contents.slice(methodStart, methodEnd);
  const assignmentPattern =
    /^([ \t]*)(\w+)\.(left|right)BarButtonItems[ \t]*=[ \t]*([\s\S]*?);[ \t]*$/gm;
  let match;
  const edits = [];
  const counts = { left: 0, right: 0 };

  while ((match = assignmentPattern.exec(methodSource)) !== null) {
    const [statement, indentation, owner, side] = match;
    counts[side] += 1;
    const ordinal = counts[side];
    const operation = `header-config-updateViewController-${owner}-${side}`;
    const marker = `${PLUGIN_MARKER} property setter ${owner} ${side} ${ordinal}`;
    if (contents.includes(marker)) continue;
    const suffix = `${side}${ordinal}`;
    const beforeItems = `rnsToolbarMorphHeaderBefore${suffix}`;
    const context = `rnsToolbarMorphHeaderContext${suffix}`;
    const enabled = `rnsToolbarMorphHeaderEnabled${suffix}`;
    const absoluteStart = methodStart + match.index;
    const before = `${indentation}// ${marker}\n${indentation}BOOL ${enabled} = RNSIsToolbarMorphDiagnosticsEnabled();\n${indentation}NSArray<UIBarButtonItem *> *${beforeItems} = ${enabled} ? (${owner}.${side}BarButtonItems ?: @[]) : @[];\n${indentation}id ${context} = RNSBeginToolbarMorphDiagnosticOperation(@"${operation}", @"updateViewController");\n${indentation}if (${enabled}) RNSLogToolbarMorphNavigationItemMutation(@"navigation_item_setter", @"${operation}", @"before", @"${side}", ${owner}, ${beforeItems}, ${beforeItems}, vc, ((UINavigationController *)vc.parentViewController), animated);\n`;
    const after = `\n${indentation}if (${enabled}) RNSLogToolbarMorphNavigationItemMutation(@"navigation_item_setter", @"${operation}", @"after", @"${side}", ${owner}, ${beforeItems}, ${owner}.${side}BarButtonItems ?: @[], vc, ((UINavigationController *)vc.parentViewController), animated);\n${indentation}RNSEndToolbarMorphDiagnosticOperation(${context});`;
    edits.push({
      start: absoluteStart,
      end: absoluteStart + statement.length,
      replacement: `${before}${statement}${after}`,
    });
  }

  if (edits.length === 0) return;
  let patched = contents;
  for (const edit of edits.reverse()) {
    patched = `${patched.slice(0, edit.start)}${edit.replacement}${patched.slice(edit.end)}`;
  }
  fs.writeFileSync(filePath, patched);
}

function instrumentHeaderSnapshotAssignments(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const pattern = /^([ \t]*)item\.customView = snapshot;[ \t]*$/gm;
  let match;
  const edits = [];
  let ordinal = 0;

  while ((match = pattern.exec(contents)) !== null) {
    ordinal += 1;
    const [statement, indentation] = match;
    const marker = `${PLUGIN_MARKER} Fabric snapshot customView setter ${ordinal}`;
    if (contents.includes(marker)) continue;
    const context = `rnsToolbarMorphSnapshotContext${ordinal}`;
    const enabled = `rnsToolbarMorphSnapshotEnabled${ordinal}`;
    const operation = `fabric-snapshot-customView-${ordinal}`;
    const method = objectiveCMethodNameAt(contents, match.index);
    const before = `${indentation}// ${marker}\n${indentation}BOOL ${enabled} = RNSIsToolbarMorphDiagnosticsEnabled();\n${indentation}id ${context} = RNSBeginToolbarMorphDiagnosticOperation(@"${operation}", @"${method}");\n${indentation}if (${enabled}) RNSLogToolbarMorphItem(@"fabric_snapshot_customView_before", item, nil, @"customView", @"fabric_snapshot", @"before_replacement", nil, NO, NO);\n`;
    const after = `\n${indentation}if (${enabled}) RNSLogToolbarMorphItem(@"fabric_snapshot_customView_after", item, nil, @"customView", @"fabric_snapshot", @"after_replacement", nil, NO, NO);\n${indentation}RNSEndToolbarMorphDiagnosticOperation(${context});`;
    edits.push({
      start: match.index,
      end: match.index + statement.length,
      replacement: `${before}${statement}${after}`,
    });
  }

  if (edits.length === 0) return;
  let patched = contents;
  for (const edit of edits.reverse()) {
    patched = `${patched.slice(0, edit.start)}${edit.replacement}${patched.slice(edit.end)}`;
  }
  fs.writeFileSync(filePath, patched);
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
  const headerSubviewHeader = path.join(screensRoot, 'ios', 'RNSScreenStackHeaderSubview.h');
  insertBefore(
    headerSubviewHeader,
    '- (UIBarButtonItem *)getUIBarButtonItem;',
    `/** Returns the already-materialized toolbar item without creating one. Used by diagnostics only. */
- (nullable UIBarButtonItem *)rns_toolbarMorphExistingBarButtonItem;
`,
    `${PLUGIN_MARKER} non-materializing item accessor declaration`,
  );
  insertBefore(
    headerSubview,
    '- (void)invalidateUIBarButtonItem',
    `- (UIBarButtonItem *)rns_toolbarMorphExistingBarButtonItem
{
  return _barButtonItem;
}

`,
    `${PLUGIN_MARKER} non-materializing item accessor implementation`,
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
  if (RNSIsToolbarMorphDiagnosticsEnabled()) {
    if (RNSFindToolbarMorphRoleInView(self, 0) != nil) {
      UIBarButtonItem *toolbarMorphItem = [self rns_toolbarMorphExistingBarButtonItem];
      objc_setAssociatedObject(self, &RNSToolbarMorphPreviousSuperviewTokenKey,
          RNSToolbarMorphToken(self.superview, @"view"), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      RNSLogToolbarMorphViewLifecycle(@"custom_subview_will_move_superview", self, newSuperview,
          toolbarMorphItem, nil, newSuperview.window, @"view-will-move-to-superview", @"before-superview-change");
    }
  }
  [super willMoveToSuperview:newSuperview];
}

- (void)didMoveToSuperview
{
  [super didMoveToSuperview];
  if (RNSIsToolbarMorphDiagnosticsEnabled()) {
    if (RNSFindToolbarMorphRoleInView(self, 0) != nil ||
        objc_getAssociatedObject(self, &RNSToolbarMorphPreviousSuperviewTokenKey) != nil) {
      UIBarButtonItem *toolbarMorphItem = [self rns_toolbarMorphExistingBarButtonItem];
      RNSLogToolbarMorphViewLifecycle(@"custom_subview_did_move_superview", self, nil,
          toolbarMorphItem, nil, nil, @"view-did-move-to-superview", @"after-superview-change");
      objc_setAssociatedObject(self, &RNSToolbarMorphPreviousSuperviewTokenKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }
  }
}

- (void)willMoveToWindow:(UIWindow *)newWindow
{
  if (RNSIsToolbarMorphDiagnosticsEnabled()) {
    if (RNSFindToolbarMorphRoleInView(self, 0) != nil) {
      UIBarButtonItem *toolbarMorphItem = [self rns_toolbarMorphExistingBarButtonItem];
      UIWindow *previousWindow = self.window;
      NSString *previousWindowToken = RNSToolbarMorphToken(previousWindow, @"window");
      objc_setAssociatedObject(self, &RNSToolbarMorphPreviousWindowAttachedKey,
          @(previousWindow != nil), OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      objc_setAssociatedObject(self, &RNSToolbarMorphPreviousWindowTokenKey,
          previousWindowToken, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      RNSLogToolbarMorphViewLifecycle(@"custom_subview_will_move_window", self, nil,
          toolbarMorphItem, previousWindowToken, newWindow, @"view-will-move-to-window", @"before-window-change");
    }
  }
  [super willMoveToWindow:newWindow];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (RNSIsToolbarMorphDiagnosticsEnabled()) {
    if (objc_getAssociatedObject(self, &RNSToolbarMorphPreviousWindowAttachedKey) != nil) {
      UIBarButtonItem *toolbarMorphItem = [self rns_toolbarMorphExistingBarButtonItem];
      BOOL wasAttached = [objc_getAssociatedObject(self, &RNSToolbarMorphPreviousWindowAttachedKey) boolValue];
      NSString *previousWindowToken = objc_getAssociatedObject(self, &RNSToolbarMorphPreviousWindowTokenKey);
      RNSLogToolbarMorphViewLifecycle(@"custom_subview_did_move_window", self, nil,
          toolbarMorphItem, previousWindowToken, self.window, @"view-did-move-to-window", @"after-window-change");
      if (wasAttached && self.window == nil) {
        RNSLogToolbarMorphAttachmentLoss(self, toolbarMorphItem, previousWindowToken);
      }
      objc_setAssociatedObject(self, &RNSToolbarMorphPreviousWindowAttachedKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
      objc_setAssociatedObject(self, &RNSToolbarMorphPreviousWindowTokenKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }
  }
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
    headerConfig,
    '        for (UIBarButtonItem *item in navitem.leftBarButtonItems) {',
    `          if (RNSIsToolbarMorphDiagnosticsEnabled()) RNSLogToolbarMorphItem(@"fabric_snapshot_candidate", item, nil, @"left",
              @"fabric_snapshot", item.customView == childComponentView ? @"custom_view_is_subview" : @"custom_view_is_wrapper_or_other",
              nil, NO, NO);`,
    `${PLUGIN_MARKER} Fabric left snapshot candidate`,
  );
  insertAfter(
    headerConfig,
    '        for (UIBarButtonItem *item in navitem.rightBarButtonItems) {',
    `          if (RNSIsToolbarMorphDiagnosticsEnabled()) RNSLogToolbarMorphItem(@"fabric_snapshot_candidate", item, nil, @"right",
              @"fabric_snapshot", item.customView == childComponentView ? @"custom_view_is_subview" : @"custom_view_is_wrapper_or_other",
              nil, NO, NO);`,
    `${PLUGIN_MARKER} Fabric right snapshot candidate`,
  );
  insertBefore(
    headerConfig,
    '  [childComponentView removeFromSuperview];',
    `  BOOL toolbarMorphDiagnosticsEnabled = RNSIsToolbarMorphDiagnosticsEnabled();
  RNSScreenStackHeaderSubview *toolbarMorphSubview = toolbarMorphDiagnosticsEnabled &&
      [childComponentView isKindOfClass:[RNSScreenStackHeaderSubview class]]
          && RNSFindToolbarMorphRoleInView(childComponentView, 0) != nil
          ? (RNSScreenStackHeaderSubview *)childComponentView : nil;
  UIBarButtonItem *toolbarMorphExistingItem =
      [toolbarMorphSubview rns_toolbarMorphExistingBarButtonItem];
  NSString *toolbarMorphPreviousWindow = toolbarMorphDiagnosticsEnabled
      ? RNSToolbarMorphToken(childComponentView.window, @"window") : @"none";
  id toolbarMorphFabricRemoveContext = nil;
  if (toolbarMorphDiagnosticsEnabled) {
    toolbarMorphFabricRemoveContext = RNSBeginToolbarMorphDiagnosticOperation(
        @"fabric-unmount-removeFromSuperview", @"unmountChildComponentView");
    RNSLogToolbarMorphViewLifecycle(@"fabric_unmount_before_remove", childComponentView, nil,
        toolbarMorphExistingItem, toolbarMorphPreviousWindow, nil,
        @"fabric-unmount-removeFromSuperview", isGoingToBeRemoved ? @"screen-marked-for-unmount" : @"screen-retained");
  }`,
    `${PLUGIN_MARKER} Fabric header subview removal before`,
  );
  insertAfter(
    headerConfig,
    '  [childComponentView removeFromSuperview];',
    `  if (toolbarMorphDiagnosticsEnabled) {
    RNSLogToolbarMorphViewLifecycle(@"fabric_unmount_after_remove", childComponentView, nil,
        toolbarMorphExistingItem, toolbarMorphPreviousWindow, nil,
        @"fabric-unmount-removeFromSuperview", isGoingToBeRemoved ? @"screen-marked-for-unmount" : @"screen-retained");
    RNSEndToolbarMorphDiagnosticOperation(toolbarMorphFabricRemoveContext);
  }`,
    `${PLUGIN_MARKER} Fabric header subview removal after`,
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

  instrumentObjectiveCNavigationItemSetters(controllerPath, 'tab-controller');
  instrumentHeaderConfigPropertySetters(headerConfig);
  instrumentHeaderSnapshotAssignments(headerConfig);
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
    'import Foundation\nimport UIKit\nimport os',
    `${PLUGIN_MARKER} Host logger imports`,
  );
  insertAfter(
    hostPath,
    'internal final class HostViewProps: ExpoSwiftUI.ViewProps, ExpoSwiftUI.SafeAreaControllable, ExpoSwiftUI.HostingViewAware {',
    `  @Field var testID: String?
  private var toolbarMorphHostToken: String?
  private var lastToolbarMorphLayout: String?

  func logToolbarMorphHostLifecycle(_ event: String) {
    guard toolbarMorphDiagnosticsEnabled else { return }
    guard let role = toolbarMorphRole else { return }
    let hostView = hostingView
    installToolbarMorphIdentifierIfNeeded(on: hostView, role: role)
    let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
    let processIdentifier = ProcessInfo.processInfo.processIdentifier
    logger.info(
      "event=\\(event, privacy: .public) variant=\\(self.toolbarMorphExperimentVariant, privacy: .public) role=\\(role, privacy: .public) pid=\\(processIdentifier, privacy: .public) uptime_ms=\\(uptimeMilliseconds, privacy: .public) host=\\(self.toolbarMorphToken, privacy: .public) parent=\\(self.objectToken(hostView?.superview), privacy: .public) window=\\(self.objectToken(hostView?.window), privacy: .public) attached=\\(hostView?.superview != nil, privacy: .public) hidden=\\(hostView?.isHidden ?? false, privacy: .public) alpha_milli=\\(Int(((hostView?.alpha ?? 0) * 1_000).rounded()), privacy: .public)"
    )
  }

  func prepareToolbarMorphHostIdentity() {
    guard let role = toolbarMorphRole else { return }
    installToolbarMorphIdentifierIfNeeded(on: hostingView, role: role)
  }

  func logToolbarMorphHostLayout(_ size: CGSize) {
    guard toolbarMorphDiagnosticsEnabled else { return }
    guard let role = toolbarMorphRole else { return }
    let width = Int(size.width.rounded())
    let height = Int(size.height.rounded())
    let layout = "\\(width)x\\(height)"
    guard layout != lastToolbarMorphLayout else { return }
    lastToolbarMorphLayout = layout
    let hostView = hostingView
    installToolbarMorphIdentifierIfNeeded(on: hostView, role: role)
    let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
    let processIdentifier = ProcessInfo.processInfo.processIdentifier
    logger.info(
      "event=host_layout variant=\\(self.toolbarMorphExperimentVariant, privacy: .public) role=\\(role, privacy: .public) pid=\\(processIdentifier, privacy: .public) host=\\(self.toolbarMorphToken, privacy: .public) parent=\\(self.objectToken(hostView?.superview), privacy: .public) window=\\(self.objectToken(hostView?.window), privacy: .public) uptime_ms=\\(uptimeMilliseconds, privacy: .public) width=\\(width, privacy: .public) height=\\(height, privacy: .public) available=\\(width > 0 && height > 0, privacy: .public) attached=\\(hostView?.superview != nil, privacy: .public) hidden=\\(hostView?.isHidden ?? false, privacy: .public) alpha_milli=\\(Int(((hostView?.alpha ?? 0) * 1_000).rounded()), privacy: .public)"
    )
  }

  private var toolbarMorphExperimentVariant: String {
    let configuredVariant = Bundle.main.infoDictionary?[\"EmporioToolbarMorphExperimentVariant\"] as? String
    return configuredVariant == \"B\" ? \"B\" : \"A\"
  }

  private var toolbarMorphDiagnosticsEnabled: Bool {
    #if DEBUG
    return true
    #else
    return (Bundle.main.infoDictionary?["EmporioToolbarMorphDiagnosticsEnabled"] as? Bool) == true
    #endif
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

  private func objectToken(_ object: AnyObject?) -> String {
    guard let object else { return "none" }
    return String(UInt(bitPattern: Unmanaged.passUnretained(object).toOpaque()), radix: 16)
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
