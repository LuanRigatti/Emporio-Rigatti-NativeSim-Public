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
  if ([item.accessibilityLabel isEqualToString:@"Período financeiro"]) return @"finance-reference";
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
    @"detached_custom_view", @"already_attached_or_not_repairable", @"bar_window_missing",
    @"destination_not_selected", @"source_window_missing", @"replacement_identity_unstable",
    @"attachment_checked",
    @"transition_active", @"source_unavailable", @"same_instances", @"setter_completed"
  ];
  return [allowed containsObject:reason] ? reason : @"other";
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
      "event=%{public}@ role=%{public}@ item=%{public}@ counterpart=%{public}@ same_instance=%{public}ld custom_view=%{public}@ side=%{public}@ reason=%{public}@ result=%{public}@ uptime_ms=%{public}llu item_class=%{public}@ custom_class=%{public}@ custom_available=%{public}d window=%{public}d bar_window=%{public}d same_window=%{public}d attached=%{public}d width=%{public}ld height=%{public}ld hidden=%{public}ld alpha_milli=%{public}ld animated=%{public}d transition_active=%{public}d",
      event, role, itemToken, counterpartToken, (long)sameInstance, customToken, side,
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
      "event=%{public}@ role=coordinator source=%{public}@ from_index=%{public}ld to_index=%{public}ld uptime_ms=%{public}llu animated=%{public}d transition_active=%{public}d cancelled=%{public}d",
      event, source, (long)fromIndex, (long)toIndex, uptimeMilliseconds, animated, transitionActive, cancelled);
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
    if (!fs.readFileSync(headerPath, 'utf8').includes(HEADER_MARKER)) {
      throw new Error(`Refusing to replace an unrelated file at ${headerPath}.`);
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
    `  RNSLogToolbarMorphItems(@"coordinator_capture", materialized[@"left"], nil,
      @"left", @"materialization", @"captured", navigationController.navigationBar, NO,
      navigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"coordinator_capture", materialized[@"right"], nil,
      @"right", @"materialization", @"captured", navigationController.navigationBar, NO,
      navigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator capture`,
  );

  insertBefore(
    controllerPath,
    '    return; // UIKit owns the in-flight morph; didShow reconciles the actual destination.',
    `    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.leftBarButtonItems ?: @[], nil,
        @"left", @"transition_active", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, YES);
    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.rightBarButtonItems ?: @[], nil,
        @"right", @"transition_active", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, YES);`,
    `${PLUGIN_MARKER} coordinator transition early return`,
  );

  insertBefore(
    controllerPath,
    '    return; // Missing source is not a deliberate empty toolbar.',
    `    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.leftBarButtonItems ?: @[], nil,
        @"left", @"source_unavailable", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
    RNSLogToolbarMorphItems(@"coordinator_early_return",
        sharedNavigationController.topViewController.navigationItem.rightBarButtonItems ?: @[], nil,
        @"right", @"source_unavailable", @"reconcile_skipped", sharedNavigationController.navigationBar,
        NO, sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} coordinator source early return`,
  );

  insertAfter(
    controllerPath,
    '      !(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual) &&\n      !isTransitionCompletion;',
    `  RNSLogToolbarMorphItems(@"coordinator_apply_decision", leftItems, sharedLeftItems,
      @"left", reason, RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)
        ? @"same_instances" : @"setter_required", sharedNavigationController.navigationBar,
       shouldAnimateToolbarItemReplacement, sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"coordinator_apply_decision", rightItems, sharedRightItems,
      @"right", reason, RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)
        ? @"same_instances" : @"setter_required", sharedNavigationController.navigationBar,
       shouldAnimateToolbarItemReplacement, sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
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
      shouldAnimateToolbarItemReplacement, isTransitionCompletion);
  RNSLogToolbarMorphItems(@"coordinator_apply_result",
      sharedNavigationItem.rightBarButtonItems ?: @[], rightItems, @"right", reason,
      RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)
        ? @"same_instances" : @"setter_completed", sharedNavigationController.navigationBar,
      shouldAnimateToolbarItemReplacement, isTransitionCompletion);`,
    `${PLUGIN_MARKER} coordinator apply result`,
  );

  insertAfter(
    controllerPath,
    '  BOOL repairRight = canCheckAttachment && RNSSharedToolbarItemsNeedAttachment(rightItems, bar);',
    `  NSString *attachmentCheckReason = @"attachment_checked";
  if (!canCheckAttachment) {
    if (bar.window == nil) attachmentCheckReason = @"bar_window_missing";
    else if (!isTransitionCompletion && ![self isScreenControllerCurrentlySelected:viewController]) attachmentCheckReason = @"destination_not_selected";
    else if (!isTransitionCompletion && nestedNavigationController.topViewController.viewIfLoaded.window == nil) attachmentCheckReason = @"source_window_missing";
    else attachmentCheckReason = @"replacement_identity_unstable";
  }
  RNSLogToolbarMorphItems(@"attachment_repair_decision", leftItems, sharedLeftItems,
      @"left", repairLeft ? @"detached_custom_view" : attachmentCheckReason,
      repairLeft ? @"will_execute" : (canCheckAttachment ? @"not_needed" : @"ignored"),
      bar, NO, sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);
  RNSLogToolbarMorphItems(@"attachment_repair_decision", rightItems, sharedRightItems,
      @"right", repairRight ? @"detached_custom_view" : attachmentCheckReason,
      repairRight ? @"will_execute" : (canCheckAttachment ? @"not_needed" : @"ignored"),
      bar, NO, sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} attachment repair decision`,
  );

  insertAfter(
    controllerPath,
    '      [sharedNavigationItem setRightBarButtonItems:rightItems animated:NO];',
    `      RNSLogToolbarMorphItems(@"attachment_repair_applied", rightItems, sharedRightItems,
          @"right", @"detached_custom_view", @"setter_completed", bar, NO,
          sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} attachment repair right result`,
  );
  insertAfter(
    controllerPath,
    '      [sharedNavigationItem setLeftBarButtonItems:leftItems animated:NO];',
    `      RNSLogToolbarMorphItems(@"attachment_repair_applied", leftItems, sharedLeftItems,
          @"left", @"detached_custom_view", @"setter_completed", bar, NO,
          sharedNavigationController.transitionCoordinator != nil || nestedNavigationController.transitionCoordinator != nil);`,
    `${PLUGIN_MARKER} attachment repair left result`,
  );

  insertAfter(
    controllerPath,
    '- (BOOL)interceptUserSelectionOfViewController:(nonnull UIViewController *)viewController\n{',
    `  NSArray<RNSTabsScreenViewController *> *diagnosticTabs = [self installedScreenControllers];
  NSInteger currentTabIndex = (NSInteger)[diagnosticTabs indexOfObject:[self effectiveSelectedViewController]];
  NSInteger requestedTabIndex = (NSInteger)[diagnosticTabs indexOfObject:viewController];
  RNSLogToolbarMorphTransition(@"tab_selection_requested", @"user", currentTabIndex,
      requestedTabIndex, YES, self.transitionCoordinator != nil, NO);`,
    `${PLUGIN_MARKER} tab selection requested`,
  );
  insertAfter(
    controllerPath,
    '  [self userDidSelectViewController:viewController];',
    `  NSArray<RNSTabsScreenViewController *> *diagnosticTabs = [self installedScreenControllers];
  NSInteger selectedTabIndex = (NSInteger)[diagnosticTabs indexOfObject:viewController];
  RNSLogToolbarMorphTransition(@"tab_selection_applied", @"user", -1, selectedTabIndex,
      YES, self.transitionCoordinator != nil || viewController.transitionCoordinator != nil, NO);
  RNSObserveToolbarMorphTransition(
      self.transitionCoordinator ?: viewController.transitionCoordinator,
      @"tab", -1, selectedTabIndex, YES);`,
    `${PLUGIN_MARKER} tab selection applied`,
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
    '  auto *screenView = static_cast<RNSScreenView *>(viewController.view);',
    `  RNSLogToolbarMorphTransition(@"navigation_transition_will_show", @"stack", -1, -1,
      animated, navigationController.transitionCoordinator != nil, NO);
  RNSObserveToolbarMorphTransition(navigationController.transitionCoordinator,
      @"stack", -1, -1, animated);`,
    `${PLUGIN_MARKER} navigation transition start`,
  );
  insertAfter(
    stack,
    '- (void)navigationController:(UINavigationController *)navigationController\n       didShowViewController:(UIViewController *)viewController\n                    animated:(BOOL)animated\n{\n  [self emitOnFinishTransitioningEvent];\n  [RNSScreenWindowTraits updateWindowTraits];',
    `  RNSLogToolbarMorphTransition(@"navigation_transition_did_show", @"stack", -1, -1,
      animated, navigationController.transitionCoordinator != nil, NO);`,
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
      "event=\\(event, privacy: .public) role=\\(role, privacy: .public) host=\\(toolbarMorphToken, privacy: .public) uptime_ms=\\(uptimeMilliseconds, privacy: .public) window=\\(hostView?.window != nil, privacy: .public) attached=\\(hostView?.superview != nil, privacy: .public) hidden=\\(hostView?.isHidden ?? false, privacy: .public) alpha_milli=\\(Int(((hostView?.alpha ?? 0) * 1_000).rounded()), privacy: .public)"
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
      "event=host_layout role=\\(role, privacy: .public) host=\\(toolbarMorphToken, privacy: .public) uptime_ms=\\(uptimeMilliseconds, privacy: .public) width=\\(width, privacy: .public) height=\\(height, privacy: .public) available=\\(width > 0 && height > 0, privacy: .public) window=\\(hostView?.window != nil, privacy: .public) attached=\\(hostView?.superview != nil, privacy: .public) hidden=\\(hostView?.isHidden ?? false, privacy: .public) alpha_milli=\\(Int(((hostView?.alpha ?? 0) * 1_000).rounded()), privacy: .public)"
    )
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
