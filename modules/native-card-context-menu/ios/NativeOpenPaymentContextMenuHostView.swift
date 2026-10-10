import ExpoModulesCore
import Foundation
import OSLog
import QuartzCore
import UIKit

protocol NativeContextMenuPreviewPresentationHost: AnyObject {
  func prepareForPreviewCommit(
    in navigationController: UINavigationController,
    previewController: NativeContextMenuPreviewViewController
  )
  func previewCommitDidComplete(in navigationController: UINavigationController)
}

public final class NativeOpenPaymentContextMenuHostView: ExpoView,
  NativeContextMenuPreviewPresentationHost,
  UINavigationControllerDelegate {
  let onExpandedPreviewChange = EventDispatcher()

  var active = false {
    didSet {
      guard active != oldValue else { return }
      logEvent("host-active", details: "active=\(active)")
      if active {
        pendingDeactivation = false
        installNavigationControllerIfNeeded()
      } else {
        deactivateNavigationController()
      }
    }
  }

  private weak var hostViewController: UIViewController?
  private weak var expandedPreviewController: NativeContextMenuPreviewViewController?
  private var originalSourceBackAction: UIAction?
  private var originalSiblingPrefersLargeTitles: Bool?
  private var originalSiblingLargeTitleTextAttributes: [NSAttributedString.Key: Any]?
  private var hasTemporarySourceBackAction = false
  private var hasTemporaryLargeTitleAppearance = false
  private var navigationController: UINavigationController?
  private var rootViewController: NativeOpenPaymentContextMenuRootViewController?
  private var commitInProgress = false
  private var sourceBackDismissalInProgress = false
  private var pendingDeactivation = false
  private var pendingTeardown = false
  private var deactivationCompletionScheduled = false
  private var expandedPreviewIsPresented = false
  private let observedGestureRecognizers = NSHashTable<UIGestureRecognizer>.weakObjects()
  private var observedGestureRecognizerIDs = Set<ObjectIdentifier>()
  private var lastLoggedGestureStates: [ObjectIdentifier: String] = [:]
  private var observedTransitionCoordinatorIDs = Set<ObjectIdentifier>()
  private weak var sampledTransitionContainerView: UIView?
  private weak var sampledTransitionFromView: UIView?
  private weak var sampledTransitionToView: UIView?
  private var transitionGeometryDisplayLink: CADisplayLink?
  private var lastTransitionGeometrySampleTimestamp: CFTimeInterval = 0
  private var transitionGeometrySampleCount = 0
  private let logger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "NativeCardContextMenu",
    category: "OpenPaymentPeekPopReturn"
  )

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    isOpaque = false
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    logEvent(
      "host-window",
      details: "attached=\(window != nil) host=\(objectIdentity(self)) " +
        "window=\(window.map(objectIdentity) ?? "nil")"
    )
    if window == nil {
      requestTeardown()
    } else if active {
      installNavigationControllerIfNeeded()
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    if active {
      installNavigationControllerIfNeeded()
    }
  }

  func navigationControllerForPreview() -> UINavigationController? {
    guard active, window != nil else { return nil }
    installNavigationControllerIfNeeded()
    return navigationController
  }

  func prepareForPreviewCommit(
    in navigationController: UINavigationController,
    previewController: NativeContextMenuPreviewViewController
  ) {
    guard self.navigationController === navigationController,
          active,
          window != nil else {
      return
    }

    installSourceBackActionForExpandedPreview()
    if !hasTemporaryLargeTitleAppearance {
      originalSiblingPrefersLargeTitles = navigationController.navigationBar.prefersLargeTitles
      originalSiblingLargeTitleTextAttributes = navigationController.navigationBar.largeTitleTextAttributes
      hasTemporaryLargeTitleAppearance = true
    }
    expandedPreviewController = previewController
    navigationController.navigationBar.prefersLargeTitles = true
    previewController.prepareForExpandedPagePresentation(in: navigationController)
    previewController.navigationItem.setHidesBackButton(true, animated: false)
    commitInProgress = true
    pendingDeactivation = false
    navigationController.view.isUserInteractionEnabled = true
    navigationController.setNavigationBarHidden(false, animated: false)
    bringSubviewToFront(navigationController.view)
    setExpandedPreviewPresented(true)
    logTransitionGeometry(
      "expanded-prepared",
      navigationController: navigationController,
      destination: previewController,
      animated: false
    )
  }

  func previewCommitDidComplete(in navigationController: UINavigationController) {
    guard self.navigationController === navigationController else { return }
    commitInProgress = false
    logEvent(
      "preview-commit-complete",
      details: "top=\(navigationController.topViewController.map(controllerIdentity) ?? "nil")"
    )
    logNavigationControllerState(role: "sibling", navigationController: navigationController)
    if let ownerNavigationController = hostViewController?.navigationController {
      logNavigationControllerState(role: "owner", navigationController: ownerNavigationController)
      if let ownerTransitionCoordinator = ownerNavigationController.transitionCoordinator {
        logCurrentTransitionContext(
          role: "owner",
          navigationController: ownerNavigationController,
          coordinator: ownerTransitionCoordinator
        )
      }
    }

    if navigationController.topViewController === rootViewController {
      restoreExpandedPreviewState()
    }

    if pendingTeardown || window == nil {
      tearDownNavigationControllerWhenSafe()
    } else if pendingDeactivation || !active {
      deactivateNavigationController()
    }
  }

  public func navigationController(
    _ navigationController: UINavigationController,
    willShow viewController: UIViewController,
    animated: Bool
  ) {
    guard self.navigationController === navigationController else { return }
    logTransitionGeometry(
      "willShow",
      navigationController: navigationController,
      destination: viewController,
      animated: animated
    )
  }

  public func navigationController(
    _ navigationController: UINavigationController,
    didShow viewController: UIViewController,
    animated: Bool
  ) {
    guard self.navigationController === navigationController else {
      return
    }

    logTransitionGeometry(
      "didShow",
      navigationController: navigationController,
      destination: viewController,
      animated: animated
    )
    stopTransitionGeometrySampling()
    sourceBackDismissalInProgress = false
    if viewController === expandedPreviewController {
      refreshGestureDiagnostics()
    }
    guard viewController === rootViewController else { return }

    restoreExpandedPreviewState()
    stopGestureDiagnostics()
    navigationController.setNavigationBarHidden(true, animated: false)
    navigationController.view.isUserInteractionEnabled = false

    if pendingTeardown || window == nil {
      tearDownNavigationControllerWhenSafe()
    } else if pendingDeactivation || !active {
      pendingDeactivation = false
    }
  }

  private func installNavigationControllerIfNeeded() {
    guard window != nil,
          active,
          navigationController == nil,
          let hostViewController = nearestViewController() else {
      return
    }

    let rootViewController = NativeOpenPaymentContextMenuRootViewController()
    rootViewController.navigationItem.backButtonTitle = "Voltar"

    let navigationController = UINavigationController(rootViewController: rootViewController)
    navigationController.delegate = self
    navigationController.setNavigationBarHidden(true, animated: false)
    navigationController.view.backgroundColor = .clear
    navigationController.view.isOpaque = false
    navigationController.view.isUserInteractionEnabled = false
    navigationController.view.translatesAutoresizingMaskIntoConstraints = false

    hostViewController.addChild(navigationController)
    addSubview(navigationController.view)
    NSLayoutConstraint.activate([
      navigationController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      navigationController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      navigationController.view.topAnchor.constraint(equalTo: topAnchor),
      navigationController.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    navigationController.didMove(toParent: hostViewController)

    self.hostViewController = hostViewController
    self.navigationController = navigationController
    self.rootViewController = rootViewController
    logEvent(
      "sibling-installed",
      details: "siblingNav=\(objectIdentity(navigationController)) " +
        "ownerNav=\(hostViewController.navigationController.map(objectIdentity) ?? "nil") " +
        "parent=\(controllerIdentity(hostViewController))"
    )
    logNavigationControllerState(role: "sibling", navigationController: navigationController)
    if let ownerNavigationController = hostViewController.navigationController {
      logNavigationControllerState(role: "owner", navigationController: ownerNavigationController)
    }
  }

  private func deactivateNavigationController() {
    guard let navigationController else { return }
    if let topViewController = navigationController.topViewController {
      logTransitionGeometry(
        "deactivation-request",
        navigationController: navigationController,
        destination: topViewController,
        animated: false
      )
    }
    if commitInProgress || navigationController.transitionCoordinator != nil {
      pendingDeactivation = true
      if let transitionCoordinator = navigationController.transitionCoordinator {
        scheduleDeactivationAfterTransition(transitionCoordinator)
      }
      return
    }
    popToRootAndDisable(navigationController)
  }

  private func scheduleDeactivationAfterTransition(
    _ transitionCoordinator: UIViewControllerTransitionCoordinator
  ) {
    guard !deactivationCompletionScheduled else { return }
    deactivationCompletionScheduled = true

    let didRegisterCompletion = transitionCoordinator.animate(
      alongsideTransition: nil
    ) { [weak self] _ in
      self?.completePendingDeactivation()
    }
    if !didRegisterCompletion {
      completePendingDeactivation()
    }
  }

  private func completePendingDeactivation() {
    deactivationCompletionScheduled = false
    guard let navigationController,
          pendingDeactivation || !active else {
      return
    }

    if pendingTeardown || window == nil {
      tearDownNavigationControllerWhenSafe()
    } else if !commitInProgress {
      popToRootAndDisable(navigationController)
    }
  }

  private func popToRootAndDisable(_ navigationController: UINavigationController) {
    guard self.navigationController === navigationController else { return }
    pendingDeactivation = false
    stopGestureDiagnostics()
    if navigationController.topViewController !== rootViewController {
      navigationController.popToRootViewController(animated: false)
      restoreExpandedPreviewState()
    } else {
      restoreExpandedPreviewState()
      navigationController.setNavigationBarHidden(true, animated: false)
      navigationController.view.isUserInteractionEnabled = false
    }
  }

  private func requestTeardown() {
    guard let navigationController else { return }
    if let topViewController = navigationController.topViewController {
      logTransitionGeometry(
        "teardown-request",
        navigationController: navigationController,
        destination: topViewController,
        animated: false
      )
    }
    if commitInProgress {
      pendingTeardown = true
      return
    }
    tearDownNavigationControllerWhenSafe()
  }

  private func tearDownNavigationControllerWhenSafe() {
    guard let navigationController else { return }
    if commitInProgress {
      pendingTeardown = true
      return
    }
    if let transitionCoordinator = navigationController.transitionCoordinator {
      pendingTeardown = true
      transitionCoordinator.animate(alongsideTransition: nil) { [weak self] _ in
        self?.tearDownNavigationController()
      }
      return
    }
    tearDownNavigationController()
  }

  private func tearDownNavigationController() {
    guard let navigationController else { return }
    if let topViewController = navigationController.topViewController {
      logTransitionGeometry(
        "teardown",
        navigationController: navigationController,
        destination: topViewController,
        animated: false
      )
    }
    stopTransitionGeometrySampling()
    stopGestureDiagnostics()
    restoreExpandedPreviewState()
    pendingTeardown = false
    pendingDeactivation = false
    navigationController.delegate = nil
    navigationController.willMove(toParent: nil)
    navigationController.view.removeFromSuperview()
    navigationController.removeFromParent()
    self.navigationController = nil
    rootViewController = nil
    hostViewController = nil
  }

  private func installSourceBackActionForExpandedPreview() {
    guard let hostViewController else { return }
    if !hasTemporarySourceBackAction {
      originalSourceBackAction = hostViewController.navigationItem.backAction
      hasTemporarySourceBackAction = true
    }
    hostViewController.navigationItem.backAction = UIAction { [weak self] _ in
      self?.popExpandedPreviewToList()
    }
  }

  private func popExpandedPreviewToList() {
    guard !sourceBackDismissalInProgress,
          let navigationController,
          let rootViewController,
          navigationController.topViewController !== rootViewController else {
      return
    }

    sourceBackDismissalInProgress = true
    logTransitionGeometry(
      "button-return-request",
      navigationController: navigationController,
      destination: rootViewController,
      animated: true
    )
    navigationController.popViewController(animated: true)
  }

  private func restoreSourceBackAction() {
    guard hasTemporarySourceBackAction else { return }
    hostViewController?.navigationItem.backAction = originalSourceBackAction
    originalSourceBackAction = nil
    hasTemporarySourceBackAction = false
    sourceBackDismissalInProgress = false
  }

  private func restoreExpandedPreviewState() {
    restoreSourceBackAction()
    if hasTemporaryLargeTitleAppearance {
      if let originalSiblingPrefersLargeTitles {
        navigationController?.navigationBar.prefersLargeTitles = originalSiblingPrefersLargeTitles
      }
      navigationController?.navigationBar.largeTitleTextAttributes =
        originalSiblingLargeTitleTextAttributes
    }
    expandedPreviewController?.restorePeekPresentation()
    expandedPreviewController = nil
    originalSiblingPrefersLargeTitles = nil
    originalSiblingLargeTitleTextAttributes = nil
    hasTemporaryLargeTitleAppearance = false
    setExpandedPreviewPresented(false)
  }

  private func setExpandedPreviewPresented(_ presented: Bool) {
    guard expandedPreviewIsPresented != presented else { return }
    expandedPreviewIsPresented = presented
    onExpandedPreviewChange(["expanded": presented])
  }

  private func logTransitionGeometry(
    _ phase: String,
    navigationController: UINavigationController,
    destination: UIViewController,
    animated: Bool
  ) {
    let transitionCoordinator = navigationController.transitionCoordinator
    let owningNavigationController = hostViewController?.navigationController
    let returnPath = sourceBackDismissalInProgress ? "button" : "native-or-lifecycle"
    let isReturningToRoot = destination === rootViewController
    logEvent(
      phase,
      details: "path=\(returnPath) animated=\(animated) " +
        "destination=\(controllerIdentity(destination)) " +
        "transition=\(transitionSummary(transitionCoordinator))"
    )
    logNavigationControllerState(role: "sibling", navigationController: navigationController)
    if let owningNavigationController {
      logNavigationControllerState(role: "owner", navigationController: owningNavigationController)
    } else {
      logEvent("owner-nav", details: "state=unavailable")
    }

    var hierarchyRoots: [(String, UIView?)] = [
      ("host", self),
      ("sibling-nav-view", navigationController.view),
      ("sibling-nav-bar", navigationController.navigationBar),
      ("destination-view", destination.viewIfLoaded),
    ]
    if let owningNavigationController {
      hierarchyRoots.append(("owner-nav-view", owningNavigationController.viewIfLoaded))
      hierarchyRoots.append(("owner-nav-bar", owningNavigationController.navigationBar))
    }
    if let rootView = rootViewController?.viewIfLoaded {
      hierarchyRoots.append(("sibling-root-view", rootView))
    }
    if let previewView = expandedPreviewController?.viewIfLoaded {
      hierarchyRoots.append(("expanded-preview-view", previewView))
    }

    if let transitionCoordinator {
      let fromController = transitionCoordinator.viewController(forKey: .from)
      let toController = transitionCoordinator.viewController(forKey: .to)
      let containerView = transitionCoordinator.containerView
      logEvent(
        "transition-participants",
        details: "from=\(fromController.map(controllerIdentity) ?? "nil") " +
          "to=\(toController.map(controllerIdentity) ?? "nil") " +
          "state=\(transitionSummary(transitionCoordinator))"
      )
      logTransitionViewMapping(
        role: "sibling",
        key: "from",
        controller: fromController,
        transitionView: transitionCoordinator.view(forKey: .from)
      )
      logTransitionViewMapping(
        role: "sibling",
        key: "to",
        controller: toController,
        transitionView: transitionCoordinator.view(forKey: .to)
      )
      hierarchyRoots.append(("transition-container", containerView))
      hierarchyRoots.append(("transition-from", transitionCoordinator.view(forKey: .from)))
      hierarchyRoots.append(("transition-to", transitionCoordinator.view(forKey: .to)))
      if isReturningToRoot {
        logHierarchySnapshot(phase: phase, roots: hierarchyRoots)
      } else {
        logPrimaryViewStates(phase: phase, roots: hierarchyRoots)
      }
      observeTransition(
        transitionCoordinator,
        navigationController: navigationController,
        role: "sibling"
      )
    } else {
      if isReturningToRoot {
        logHierarchySnapshot(phase: phase, roots: hierarchyRoots)
      } else {
        logPrimaryViewStates(phase: phase, roots: hierarchyRoots)
      }
    }

    if let owningNavigationController,
       let owningTransitionCoordinator = owningNavigationController.transitionCoordinator {
      logCurrentTransitionContext(
        role: "owner",
        navigationController: owningNavigationController,
        coordinator: owningTransitionCoordinator
      )
    }
  }

  private func logCurrentTransitionContext(
    role: String,
    navigationController: UINavigationController,
    coordinator: UIViewControllerTransitionCoordinator
  ) {
    let fromController = coordinator.viewController(forKey: .from)
    let toController = coordinator.viewController(forKey: .to)
    logEvent(
      "transition-participants",
      details: "role=\(role) from=\(fromController.map(controllerIdentity) ?? "nil") " +
        "to=\(toController.map(controllerIdentity) ?? "nil") " +
        "state=\(transitionSummary(coordinator))"
    )
    logTransitionViewMapping(
      role: role,
      key: "from",
      controller: fromController,
      transitionView: coordinator.view(forKey: .from)
    )
    logTransitionViewMapping(
      role: role,
      key: "to",
      controller: toController,
      transitionView: coordinator.view(forKey: .to)
    )
    logPrimaryViewStates(
      phase: "\(role)-current",
      roots: [
        ("\(role)-nav-view", navigationController.viewIfLoaded),
        ("\(role)-nav-bar", navigationController.navigationBar),
        ("\(role)-transition-container", coordinator.containerView),
        ("\(role)-transition-from", coordinator.view(forKey: .from)),
        ("\(role)-transition-to", coordinator.view(forKey: .to)),
      ]
    )
    observeTransition(coordinator, navigationController: navigationController, role: role)
  }

  private func observeTransition(
    _ transitionCoordinator: UIViewControllerTransitionCoordinator,
    navigationController: UINavigationController,
    role: String
  ) {
    let coordinatorIdentity = ObjectIdentifier(transitionCoordinator as AnyObject)
    guard observedTransitionCoordinatorIDs.insert(coordinatorIdentity).inserted else { return }
    if transitionCoordinator.isInteractive {
      transitionCoordinator.notifyWhenInteractionChanges { [weak self, weak navigationController] context in
        guard let self, let navigationController else { return }
        self.logEvent(
          "transition-interaction-change",
          details: "role=\(role) cancelled=\(context.isCancelled) percent=\(context.percentComplete) " +
            "state=\(self.transitionSummary(context))"
        )
        self.logNavigationControllerState(role: role, navigationController: navigationController)
      }
    }

    let observerRegistered = transitionCoordinator.animate(
      alongsideTransition: { [weak self, weak navigationController] context in
        guard let self, let navigationController else { return }
        self.logEvent(
          "transition-alongside",
          details: "role=\(role) state=\(self.transitionSummary(context))"
        )
      },
      completion: { [weak self, weak navigationController] context in
        guard let self, let navigationController else { return }
        self.logEvent(
          "transition-complete",
          details: "role=\(role) cancelled=\(context.isCancelled) percent=\(context.percentComplete) " +
            "state=\(self.transitionSummary(context))"
        )
        self.logNavigationControllerState(role: role, navigationController: navigationController)
        if role == "sibling" {
          self.stopTransitionGeometrySampling()
        }
        self.observedTransitionCoordinatorIDs.remove(coordinatorIdentity)
      }
    )
    logEvent(
      "transition-observer",
      details: "role=\(role) alongsideRegistered=\(observerRegistered)"
    )
    if observerRegistered, role == "sibling", transitionCoordinator.isAnimated,
       transitionCoordinator.viewController(forKey: .to) === rootViewController {
      startTransitionGeometrySampling(transitionCoordinator)
    } else if !observerRegistered {
      observedTransitionCoordinatorIDs.remove(coordinatorIdentity)
    }
  }

  private func startTransitionGeometrySampling(
    _ transitionCoordinator: UIViewControllerTransitionCoordinator
  ) {
    stopTransitionGeometrySampling()
    sampledTransitionContainerView = transitionCoordinator.containerView
    sampledTransitionFromView = transitionCoordinator.view(forKey: .from)
    sampledTransitionToView = transitionCoordinator.view(forKey: .to)
    lastTransitionGeometrySampleTimestamp = 0
    transitionGeometrySampleCount = 0

    let displayLink = CADisplayLink(target: self, selector: #selector(sampleTransitionGeometry(_:)))
    transitionGeometryDisplayLink = displayLink
    displayLink.add(to: .main, forMode: .common)
  }

  @objc private func sampleTransitionGeometry(_ displayLink: CADisplayLink) {
    guard transitionGeometrySampleCount < 5 else {
      stopTransitionGeometrySampling()
      return
    }
    guard lastTransitionGeometrySampleTimestamp == 0 ||
      displayLink.timestamp - lastTransitionGeometrySampleTimestamp >= 0.08 else {
      return
    }

    lastTransitionGeometrySampleTimestamp = displayLink.timestamp
    transitionGeometrySampleCount += 1
    logEvent(
      "transition-frame",
      details: "sample=\(transitionGeometrySampleCount) " +
        "state=\(transitionSummary(navigationController?.transitionCoordinator))"
    )
    logTransitionFrameGeometry()

    if transitionGeometrySampleCount == 5 {
      stopTransitionGeometrySampling()
    }
  }

  private func logTransitionFrameGeometry() {
    let roots: [(String, UIView?)] = [
      ("host", self),
      ("sibling-nav-view", navigationController?.view),
      ("sibling-nav-bar", navigationController?.navigationBar),
      ("owner-nav-bar", hostViewController?.navigationController?.navigationBar),
      ("transition-container", sampledTransitionContainerView),
      ("transition-from", sampledTransitionFromView),
      ("transition-to", sampledTransitionToView),
    ]
    var loggedViewIDs = Set<ObjectIdentifier>()
    for (role, view) in roots {
      guard let view else { continue }
      loggedViewIDs.insert(ObjectIdentifier(view))
      logViewState(phase: "transition-frame-\(transitionGeometrySampleCount)", role: role, view: view)
    }

    for (role, view) in roots {
      var ancestor = view?.superview
      var depth = 1
      while let current = ancestor, depth <= 24 {
        let identity = ObjectIdentifier(current)
        if loggedViewIDs.insert(identity).inserted,
           current.clipsToBounds || current.layer.masksToBounds ||
             current.layer.mask != nil || current.mask != nil || current.layer.cornerRadius > 0 {
          logViewState(
            phase: "transition-frame-\(transitionGeometrySampleCount)",
            role: "\(role)-clip-ancestor-\(depth)",
            view: current
          )
        }
        ancestor = current.superview
        depth += 1
      }
    }
  }

  private func stopTransitionGeometrySampling() {
    transitionGeometryDisplayLink?.invalidate()
    transitionGeometryDisplayLink = nil
    sampledTransitionContainerView = nil
    sampledTransitionFromView = nil
    sampledTransitionToView = nil
    lastTransitionGeometrySampleTimestamp = 0
    transitionGeometrySampleCount = 0
  }

  private func logHierarchySnapshot(phase: String, roots: [(String, UIView?)]) {
    var loggedViewIDs = Set<ObjectIdentifier>()
    for (role, view) in roots {
      guard let view else {
        logEvent("view", details: "phase=\(phase) role=\(role) state=nil")
        continue
      }
      loggedViewIDs.insert(ObjectIdentifier(view))
      logViewState(phase: phase, role: role, view: view)
    }

    for (role, view) in roots {
      var ancestor = view?.superview
      var depth = 1
      while let current = ancestor, depth <= 24 {
        let identity = ObjectIdentifier(current)
        if loggedViewIDs.insert(identity).inserted {
          logViewState(phase: phase, role: "\(role)-ancestor-\(depth)", view: current)
        }
        ancestor = current.superview
        depth += 1
      }
      if depth > 24 {
        logEvent("view-ancestors", details: "phase=\(phase) role=\(role) truncated=true maxDepth=24")
      }
    }
  }

  private func logPrimaryViewStates(phase: String, roots: [(String, UIView?)]) {
    var loggedViewIDs = Set<ObjectIdentifier>()
    for (role, view) in roots {
      guard let view, loggedViewIDs.insert(ObjectIdentifier(view)).inserted else { continue }
      logViewState(phase: phase, role: role, view: view)
    }
  }

  private func logTransitionViewMapping(
    role: String,
    key: String,
    controller: UIViewController?,
    transitionView: UIView?
  ) {
    let controllerView = controller?.viewIfLoaded
    let matchesControllerView: Bool
    if let controllerView, let transitionView {
      matchesControllerView = controllerView === transitionView
    } else {
      matchesControllerView = false
    }
    logEvent(
      "transition-view-mapping",
      details: "role=\(role) key=\(key) controller=\(controller.map(controllerIdentity) ?? "nil") " +
        "controllerView=\(controllerView.map(objectIdentity) ?? "nil") " +
        "transitionView=\(transitionView.map(objectIdentity) ?? "nil") " +
        "sameView=\(matchesControllerView)"
    )
  }

  private func logViewState(phase: String, role: String, view: UIView) {
    let windowFrame = view.window.map { NSCoder.string(for: view.convert(view.bounds, to: $0)) } ?? "none"
    let superviewIdentity = view.superview.map(objectIdentity) ?? "nil"
    let windowIdentity = view.window.map(objectIdentity) ?? "nil"
    let transform = view.transform
    let affineTransform = "\(transform.a),\(transform.b),\(transform.c),\(transform.d),\(transform.tx),\(transform.ty)"
    let layerTransform = view.layer.transform
    let layerTransformSummary = "\(layerTransform.m11),\(layerTransform.m12),\(layerTransform.m13),\(layerTransform.m14)," +
      "\(layerTransform.m21),\(layerTransform.m22),\(layerTransform.m23),\(layerTransform.m24)," +
      "\(layerTransform.m31),\(layerTransform.m32),\(layerTransform.m33),\(layerTransform.m34)," +
      "\(layerTransform.m41),\(layerTransform.m42),\(layerTransform.m43),\(layerTransform.m44)"
    let presentationLayer = view.layer.presentation()
    let presentationFrame = presentationLayer.map { NSCoder.string(for: $0.frame) } ?? "none"
    let presentationTransform = presentationLayer.map { layer in
      let transform = layer.transform
      return "\(transform.m11),\(transform.m12),\(transform.m13),\(transform.m14)," +
        "\(transform.m21),\(transform.m22),\(transform.m23),\(transform.m24)," +
        "\(transform.m31),\(transform.m32),\(transform.m33),\(transform.m34)," +
        "\(transform.m41),\(transform.m42),\(transform.m43),\(transform.m44)"
    } ?? "none"
    let layerMask = view.layer.mask.map { mask in
      "\(String(describing: type(of: mask)))#\(ObjectIdentifier(mask))"
    } ?? "none"
    let viewMask = view.mask.map { objectIdentity($0) } ?? "none"
    var details = "phase=\(phase) role=\(role) view=\(objectIdentity(view)) " +
      "super=\(superviewIdentity) window=\(windowIdentity) " +
      "frame=\(NSCoder.string(for: view.frame)) bounds=\(NSCoder.string(for: view.bounds)) " +
      "windowFrame=\(windowFrame) affine=\(affineTransform) " +
      "layerTransform=\(layerTransformSummary) presentationFrame=\(presentationFrame) " +
      "presentationTransform=\(presentationTransform) safe=\(view.safeAreaInsets) " +
      "hidden=\(view.isHidden) alpha=\(view.alpha) interaction=\(view.isUserInteractionEnabled) " +
      "clips=\(view.clipsToBounds) masks=\(view.layer.masksToBounds) " +
      "radius=\(view.layer.cornerRadius) maskedCorners=\(view.layer.maskedCorners) " +
      "maskView=\(viewMask) layerMask=\(layerMask)"

    if let scrollView = view as? UIScrollView {
      details += " scrollEnabled=\(scrollView.isScrollEnabled) " +
        "dragging=\(scrollView.isDragging) decelerating=\(scrollView.isDecelerating) " +
        "offset=\(scrollView.contentOffset) inset=\(scrollView.contentInset) " +
        "adjustedInset=\(scrollView.adjustedContentInset)"
    }
    logEvent("view", details: details)
  }

  private func logNavigationControllerState(
    role: String,
    navigationController: UINavigationController
  ) {
    let edgePopGesture = navigationController.interactivePopGestureRecognizer
    logEvent(
      "navigation-state",
      details: "role=\(role) nav=\(objectIdentity(navigationController)) " +
        "stackCount=\(navigationController.viewControllers.count) " +
        "top=\(navigationController.topViewController.map(controllerIdentity) ?? "nil") " +
        "barHidden=\(navigationController.isNavigationBarHidden) " +
        "viewHidden=\(navigationController.viewIfLoaded?.isHidden ?? true) " +
        "interaction=\(navigationController.viewIfLoaded?.isUserInteractionEnabled ?? false) " +
        "transition=\(transitionSummary(navigationController.transitionCoordinator)) " +
        "gestureEnabled(effective)=\(edgePopGesture.map { String($0.isEnabled) } ?? "nil")"
    )

    for (index, viewController) in navigationController.viewControllers.enumerated() {
      logEvent(
        "navigation-stack-item",
        details: "role=\(role) index=\(index) count=\(navigationController.viewControllers.count) " +
          "controller=\(controllerIdentity(viewController)) functionalRole=\(controllerRole(viewController))"
      )
    }

    if let edgePopGesture {
      logGestureState("gesture-inventory", recognizer: edgePopGesture)
    } else {
      logEvent("gesture-inventory", details: "role=\(role)-edge-pop recognizer=nil")
    }
  }

  private func refreshGestureDiagnostics() {
    guard let siblingNavigationController = navigationController else { return }
    if let siblingEdgePop = siblingNavigationController.interactivePopGestureRecognizer {
      observeGestureRecognizer(siblingEdgePop)
      logGestureState("gesture-inventory", recognizer: siblingEdgePop)
    }
    if let ownerEdgePop = hostViewController?.navigationController?.interactivePopGestureRecognizer {
      observeGestureRecognizer(ownerEdgePop)
      logGestureState("gesture-inventory", recognizer: ownerEdgePop)
    }

    var scannedViewIDs = Set<ObjectIdentifier>()
    var scannedRecognizerCount = 0
    var scannedViewCount = 0
    var scanTruncated = false
    let maximumViews = 256
    let maximumDepth = 18

    func scan(_ view: UIView, depth: Int) {
      guard depth <= maximumDepth, scannedViewCount < maximumViews else {
        scanTruncated = true
        return
      }
      guard scannedViewIDs.insert(ObjectIdentifier(view)).inserted else {
        return
      }
      scannedViewCount += 1
      logReactNativeScreenGestureStateIfPresent(view)

      if let scrollView = view as? UIScrollView {
        observeGestureRecognizer(scrollView.panGestureRecognizer)
        logViewState(phase: "gesture-inventory", role: "scroll-view", view: scrollView)
        logEvent(
          "scroll-view-gesture",
          details: "view=\(objectIdentity(scrollView)) " +
            "pan=\(objectIdentity(scrollView.panGestureRecognizer)) " +
            "enabled=\(scrollView.panGestureRecognizer.isEnabled) " +
            "scrollEnabled=\(scrollView.isScrollEnabled) " +
            "offset=\(scrollView.contentOffset) inset=\(scrollView.contentInset) " +
            "adjustedInset=\(scrollView.adjustedContentInset)"
        )
      }

      for recognizer in view.gestureRecognizers ?? [] where recognizer is UIPanGestureRecognizer {
        observeGestureRecognizer(recognizer)
        logGestureState("gesture-inventory", recognizer: recognizer)
        scannedRecognizerCount += 1
      }
      for subview in view.subviews {
        scan(subview, depth: depth + 1)
      }
    }

    if let ownerNavigationController = hostViewController?.navigationController {
      if let ownerTopView = ownerNavigationController.topViewController?.viewIfLoaded {
        scan(ownerTopView, depth: 0)
      }
      scan(ownerNavigationController.view, depth: 0)
    }
    if let ownerView = hostViewController?.viewIfLoaded {
      scan(ownerView, depth: 0)
    }
    scan(self, depth: 0)
    scan(siblingNavigationController.view, depth: 0)
    logEvent(
      "gesture-scan-complete",
      details: "views=\(scannedViewCount) pans=\(scannedRecognizerCount) " +
        "truncated=\(scanTruncated)"
    )
  }

  private func logReactNativeScreenGestureStateIfPresent(_ view: UIView) {
    let className = NSStringFromClass(type(of: view))
    guard className.contains("RNSScreenView") else { return }

    let gestureEnabledSelector = NSSelectorFromString("gestureEnabled")
    let gestureEnabled: String
    if view.responds(to: gestureEnabledSelector),
       let value = view.value(forKey: "gestureEnabled") as? NSNumber {
      gestureEnabled = String(value.boolValue)
    } else {
      gestureEnabled = "unavailable"
    }
    logEvent(
      "native-stack-screen-gesture",
      details: "screen=\(objectIdentity(view)) gestureEnabled=\(gestureEnabled)"
    )
  }

  private func observeGestureRecognizer(_ recognizer: UIGestureRecognizer) {
    let identity = ObjectIdentifier(recognizer)
    guard observedGestureRecognizerIDs.insert(identity).inserted else { return }
    observedGestureRecognizers.add(recognizer)
    recognizer.addTarget(self, action: #selector(handleObservedGestureState(_:)))
  }

  @objc private func handleObservedGestureState(_ recognizer: UIGestureRecognizer) {
    let identity = ObjectIdentifier(recognizer)
    let state = gestureStateName(recognizer.state)
    if state == "changed", lastLoggedGestureStates[identity] == "changed" {
      return
    }
    lastLoggedGestureStates[identity] = state
    logGestureState("gesture-state", recognizer: recognizer)
    guard state == "began" else { return }
    if recognizer === navigationController?.interactivePopGestureRecognizer,
       let navigationController {
      logNavigationControllerState(role: "sibling", navigationController: navigationController)
      if let coordinator = navigationController.transitionCoordinator {
        logCurrentTransitionContext(role: "sibling", navigationController: navigationController, coordinator: coordinator)
      }
    } else if recognizer === hostViewController?.navigationController?.interactivePopGestureRecognizer,
              let navigationController = hostViewController?.navigationController {
      logNavigationControllerState(role: "owner", navigationController: navigationController)
      if let coordinator = navigationController.transitionCoordinator {
        logCurrentTransitionContext(role: "owner", navigationController: navigationController, coordinator: coordinator)
      }
    }
  }

  private func logGestureState(_ event: String, recognizer: UIGestureRecognizer) {
    let role: String
    if recognizer === navigationController?.interactivePopGestureRecognizer {
      role = "sibling-edge-pop"
    } else if recognizer === hostViewController?.navigationController?.interactivePopGestureRecognizer {
      role = "owner-edge-pop"
    } else if let scrollView = recognizer.view as? UIScrollView,
              scrollView.panGestureRecognizer === recognizer {
      role = "scroll-pan"
    } else if recognizer is UIPanGestureRecognizer {
      role = "competing-pan"
    } else {
      role = "other"
    }

    let delegateIdentity = recognizer.delegate.map {
      "\(String(describing: type(of: $0)))#\(ObjectIdentifier($0))"
    } ?? "nil"
    let viewIdentity = recognizer.view.map(objectIdentity) ?? "nil"
    var details = "role=\(role) recognizer=\(String(describing: type(of: recognizer)))#\(ObjectIdentifier(recognizer)) " +
      "enabled=\(recognizer.isEnabled) state=\(gestureStateName(recognizer.state)) " +
      "delegate=\(delegateIdentity) view=\(viewIdentity)"
    if let scrollView = recognizer.view as? UIScrollView,
       scrollView.panGestureRecognizer === recognizer {
      details += " scrollEnabled=\(scrollView.isScrollEnabled) dragging=\(scrollView.isDragging) " +
        "offset=\(scrollView.contentOffset) inset=\(scrollView.contentInset) " +
        "adjustedInset=\(scrollView.adjustedContentInset)"
    }
    logEvent(event, details: details)
  }

  private func stopGestureDiagnostics() {
    for recognizer in observedGestureRecognizers.allObjects {
      recognizer.removeTarget(self, action: #selector(handleObservedGestureState(_:)))
    }
    observedGestureRecognizers.removeAllObjects()
    observedGestureRecognizerIDs.removeAll()
    lastLoggedGestureStates.removeAll()
  }

  private func transitionSummary(_ coordinator: UIViewControllerTransitionCoordinator?) -> String {
    guard let coordinator else { return "coordinator=none interactive=false" }
    return "interactive=\(coordinator.isInteractive) animated=\(coordinator.isAnimated) " +
      "cancelled=\(coordinator.isCancelled) percent=\(coordinator.percentComplete)"
  }

  private func transitionSummary(_ context: UIViewControllerTransitionCoordinatorContext) -> String {
    "interactive=\(context.isInteractive) animated=\(context.isAnimated) " +
      "cancelled=\(context.isCancelled) percent=\(context.percentComplete)"
  }

  private func controllerRole(_ viewController: UIViewController) -> String {
    if viewController === rootViewController { return "sibling-root" }
    if viewController === expandedPreviewController { return "expanded-preview" }
    return "other"
  }

  private func controllerIdentity(_ viewController: UIViewController) -> String {
    "\(String(describing: type(of: viewController)))#\(ObjectIdentifier(viewController))"
  }

  private func objectIdentity(_ object: AnyObject) -> String {
    "\(String(describing: type(of: object)))#\(ObjectIdentifier(object))"
  }

  private func gestureStateName(_ state: UIGestureRecognizer.State) -> String {
    switch state {
    case .possible: return "possible"
    case .began: return "began"
    case .changed: return "changed"
    case .ended: return "ended"
    case .cancelled: return "cancelled"
    case .failed: return "failed"
    @unknown default: return "unknown"
    }
  }

  private func logEvent(_ event: String, details: String) {
    logger.notice("[PeekPopReturn] \(event, privacy: .public) \(details, privacy: .public)")
  }

  private func nearestViewController() -> UIViewController? {
    var responder: UIResponder? = self
    while let currentResponder = responder {
      if let viewController = currentResponder as? UIViewController {
        return viewController
      }
      responder = currentResponder.next
    }
    return nil
  }
}

private final class NativeOpenPaymentContextMenuRootViewController: UIViewController {
  override func loadView() {
    let rootView = UIView()
    rootView.backgroundColor = .clear
    rootView.isOpaque = false
    view = rootView
  }
}
