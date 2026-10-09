import ExpoModulesCore
import UIKit

protocol NativeContextMenuPreviewPresentationHost: AnyObject {
  func prepareForPreviewCommit(in navigationController: UINavigationController)
  func previewCommitDidComplete(in navigationController: UINavigationController)
}

public final class NativeOpenPaymentContextMenuHostView: ExpoView,
  NativeContextMenuPreviewPresentationHost,
  UINavigationControllerDelegate {
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
  private var originalSourceBackButtonHidden: Bool?
  private var navigationController: UINavigationController?
  private var rootViewController: NativeOpenPaymentContextMenuRootViewController?
  private var commitInProgress = false
  private var pendingDeactivation = false
  private var pendingTeardown = false
  private var deactivationCompletionScheduled = false

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

  func prepareForPreviewCommit(in navigationController: UINavigationController) {
    guard self.navigationController === navigationController,
          active,
          window != nil else {
      return
    }

    hideSourceBackButtonForExpandedPreview()
    commitInProgress = true
    pendingDeactivation = false
    navigationController.view.isUserInteractionEnabled = true
    navigationController.setNavigationBarHidden(false, animated: false)
    bringSubviewToFront(navigationController.view)
  }

  func previewCommitDidComplete(in navigationController: UINavigationController) {
    guard self.navigationController === navigationController else { return }
    commitInProgress = false

    if navigationController.topViewController === rootViewController {
      restoreSourceBackButton()
    }

    if pendingTeardown || window == nil {
      tearDownNavigationControllerWhenSafe()
    } else if pendingDeactivation || !active {
      deactivateNavigationController()
    }
  }

  public func navigationController(
    _ navigationController: UINavigationController,
    didShow viewController: UIViewController,
    animated: Bool
  ) {
    guard self.navigationController === navigationController,
          viewController === rootViewController else {
      return
    }

    restoreSourceBackButton()
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
    } else {
      restoreSourceBackButton()
      navigationController.setNavigationBarHidden(true, animated: false)
      navigationController.view.isUserInteractionEnabled = false
    }
  }

  private func requestTeardown() {
    guard navigationController != nil else { return }
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
    restoreSourceBackButton()
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

  private func hideSourceBackButtonForExpandedPreview() {
    guard let hostViewController else { return }
    if originalSourceBackButtonHidden == nil {
      originalSourceBackButtonHidden = hostViewController.navigationItem.hidesBackButton
    }
    hostViewController.navigationItem.setHidesBackButton(true, animated: false)
  }

  private func restoreSourceBackButton() {
    guard let wasHidden = originalSourceBackButtonHidden else { return }
    hostViewController?.navigationItem.setHidesBackButton(
      wasHidden,
      animated: false
    )
    self.originalSourceBackButtonHidden = nil
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
