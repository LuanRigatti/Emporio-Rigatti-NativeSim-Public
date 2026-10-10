import ExpoModulesCore
import OSLog
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
    sourceBackDismissalInProgress = false
    guard viewController === rootViewController else { return }

    restoreExpandedPreviewState()
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
    let transitionContainer = transitionCoordinator?.containerView
    let transitionState = transitionCoordinator.map {
      "interactive=\($0.isInteractive) animated=\($0.isAnimated) " +
        "cancelled=\($0.isCancelled) percent=\($0.percentComplete)"
    } ?? "interactive=false coordinator=none"
    let owningNavigationController = hostViewController?.navigationController
    let owningTransitionCoordinator = owningNavigationController?.transitionCoordinator
    let owningTransitionContainer = owningTransitionCoordinator?.containerView
    let owningTransitionState = owningTransitionCoordinator.map {
      "interactive=\($0.isInteractive) animated=\($0.isAnimated) " +
        "cancelled=\($0.isCancelled) percent=\($0.percentComplete)"
    } ?? "interactive=false coordinator=none"
    let owningNavigationControllerIdentity = owningNavigationController.map {
      String(describing: ObjectIdentifier($0))
    } ?? "nil"
    let returnPath = sourceBackDismissalInProgress ? "button" : "native-or-lifecycle"
    let message = "[PeekPopReturn] \(phase) path=\(returnPath) animated=\(animated) " +
      "transition={\(transitionState)} host={\(viewState(self))} " +
      "siblingNav={\(viewState(navigationController.view))} " +
      "siblingNavController=\(ObjectIdentifier(navigationController)) " +
      "transitionContainer={\(viewState(transitionContainer))} " +
      "hostAncestors={\(ancestorStates(from: self))} " +
      "containerAncestors={\(ancestorStates(from: transitionContainer))} " +
      "owningNav={\(viewState(owningNavigationController?.view))} " +
      "owningNavController=\(owningNavigationControllerIdentity) " +
      "owningTransition={\(owningTransitionState)} " +
      "owningContainer={\(viewState(owningTransitionContainer))} " +
      "destination=\(type(of: destination))#\(ObjectIdentifier(destination))"
    logger.notice("\(message, privacy: .public)")
  }

  private func viewState(_ view: UIView?) -> String {
    guard let view else { return "nil" }
    let windowFrame = view.window.map { NSStringFromCGRect($0.convert(view.bounds, from: view)) } ?? "no-window"
    return "\(type(of: view))#\(ObjectIdentifier(view)) " +
      "frame=\(NSStringFromCGRect(view.frame)) bounds=\(NSStringFromCGRect(view.bounds)) " +
      "windowFrame=\(windowFrame) hidden=\(view.isHidden) alpha=\(view.alpha) " +
      "clips=\(view.clipsToBounds) " +
      "masks=\(view.layer.masksToBounds) radius=\(view.layer.cornerRadius) " +
      "maskLayer=\(view.layer.mask != nil)"
  }

  private func ancestorStates(from view: UIView?) -> String {
    guard let view else { return "nil" }
    var states: [String] = []
    var currentView: UIView? = view
    while let ancestor = currentView, states.count < 12 {
      states.append(viewState(ancestor))
      currentView = ancestor.superview
    }
    return states.joined(separator: " <- ")
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
