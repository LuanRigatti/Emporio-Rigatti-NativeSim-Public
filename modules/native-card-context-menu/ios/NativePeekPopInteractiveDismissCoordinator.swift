import OSLog
import UIKit

final class NativePeekPopInteractiveDismissCoordinator: NSObject,
  UINavigationControllerDelegate,
  UIGestureRecognizerDelegate {
  private let logger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "NativeCardContextMenu",
    category: "PeekPopDismiss"
  )
  private weak var navigationController: UINavigationController?
  private weak var viewerController: NativeContextMenuPreviewViewController?
  private weak var scrollView: UIScrollView?
  private weak var gestureView: UIView?
  private weak var dismissPanGesture: UIPanGestureRecognizer?
  private weak var gestureWindow: UIWindow?
  private var interactionController: UIPercentDrivenInteractiveTransition?
  private var activeAnimator: NativePeekPopViewerDismissAnimator?
  private var gestureStartY: CGFloat?
  private var gestureReferenceHeight: CGFloat = 1
  private var lastLoggedProgressBucket = 0
  private var transitionInFlight = false

  deinit {
    logger.notice("dismiss coordinator teardown")
  }

  init(
    navigationController: UINavigationController,
    viewerController: NativeContextMenuPreviewViewController,
    scrollView: UIScrollView,
    gestureView: UIView
  ) {
    self.navigationController = navigationController
    self.viewerController = viewerController
    self.scrollView = scrollView
    self.gestureView = gestureView
    super.init()

    let panGesture = UIPanGestureRecognizer(
      target: self,
      action: #selector(handleDismissPan(_:))
    )
    panGesture.delegate = self
    panGesture.cancelsTouchesInView = false
    gestureView.addGestureRecognizer(panGesture)
    scrollView.panGestureRecognizer.require(toFail: panGesture)
    dismissPanGesture = panGesture
    navigationController.delegate = self
  }

  func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
    guard let panGesture = gestureRecognizer as? UIPanGestureRecognizer,
          let viewerController,
          let navigationController,
          let scrollView,
          let window = gestureView?.window,
          !transitionInFlight,
          navigationController.topViewController === viewerController else {
      logger.notice("pan gate rejected: prerequisites or viewer state")
      return false
    }

    let velocity = panGesture.velocity(in: window)
    let isVerticalDownwardPan = velocity.y > 0 && abs(velocity.y) > abs(velocity.x) * 1.15
    let scrollViewIsAtTop = scrollView.contentOffset.y
      <= -scrollView.adjustedContentInset.top + 1
    guard isVerticalDownwardPan && scrollViewIsAtTop else {
      logger.notice(
        "pan gate rejected: downward=\(isVerticalDownwardPan, privacy: .public) scrollAtTop=\(scrollViewIsAtTop, privacy: .public)"
      )
      return false
    }

    logger.notice("pan gate accepted")
    return true
  }

  func navigationController(
    _ navigationController: UINavigationController,
    animationControllerFor operation: UINavigationController.Operation,
    from fromViewController: UIViewController,
    to toViewController: UIViewController
  ) -> UIViewControllerAnimatedTransitioning? {
    guard operation == .pop,
          fromViewController === viewerController,
          interactionController != nil,
          let viewerController else {
      return nil
    }

    let animator = NativePeekPopViewerDismissAnimator(
      sourceView: viewerController.transitionSourceView
    )
    activeAnimator = animator
    logger.notice("dismiss animator provided")
    return animator
  }

  func navigationController(
    _ navigationController: UINavigationController,
    interactionControllerFor animationController: UIViewControllerAnimatedTransitioning
  ) -> UIViewControllerInteractiveTransitioning? {
    guard let activeAnimator,
          (animationController as AnyObject) === activeAnimator else {
      logger.notice("interaction controller not activated: animator mismatch")
      return nil
    }
    guard let interactionController else {
      logger.error("interaction controller not activated: missing percent driver")
      return nil
    }
    logger.notice("interaction controller activated")
    return interactionController
  }

  func navigationController(
    _ navigationController: UINavigationController,
    didShow viewController: UIViewController,
    animated: Bool
  ) {
    if let viewerController, viewController === viewerController {
      navigationController.setNavigationBarHidden(true, animated: false)
      if transitionInFlight {
        logger.notice("viewer restored after cancelled dismissal")
        resetInteractiveTransition()
      }
      return
    }

    logger.notice("dismiss teardown after destination didShow")
    navigationController.setNavigationBarHidden(true, animated: false)
    navigationController.view.isUserInteractionEnabled = false
    dismissPanGesture.map { gestureView?.removeGestureRecognizer($0) }
    navigationController.delegate = nil
    resetInteractiveTransition()
  }

  @objc private func handleDismissPan(_ gesture: UIPanGestureRecognizer) {
    guard let viewerController,
          let navigationController else {
      return
    }

    switch gesture.state {
    case .began:
      guard !transitionInFlight,
            navigationController.topViewController === viewerController,
            let window = gestureView?.window else {
        logger.notice("pan began rejected: transition or viewer state")
        return
      }
      transitionInFlight = true
      gestureWindow = window
      gestureStartY = gesture.location(in: window).y
      gestureReferenceHeight = max(navigationController.view.bounds.height, 1)
      lastLoggedProgressBucket = 0
      let interaction = UIPercentDrivenInteractiveTransition()
      interaction.completionCurve = .easeOut
      interactionController = interaction
      logger.notice("pan began; interaction created")
      guard navigationController.popViewController(animated: true) != nil else {
        logger.error("pan pop failed to start")
        resetInteractiveTransition()
        return
      }
    case .changed:
      guard transitionInFlight else {
        return
      }
      let progress = normalizedProgress(for: gesture)
      interactionController?.update(progress)
      logProgressMilestone(progress)
    case .ended:
      guard transitionInFlight else {
        return
      }
      let progress = normalizedProgress(for: gesture)
      interactionController?.update(progress)
      let velocity = gestureWindow.map { gesture.velocity(in: $0).y } ?? 0
      if progress >= 0.34 || (progress >= 0.1 && velocity >= 900) {
        logger.notice("pan finish progress=\(formatted(progress), privacy: .public)")
        interactionController?.finish()
      } else {
        logger.notice("pan cancel progress=\(formatted(progress), privacy: .public)")
        interactionController?.cancel()
      }
    case .cancelled, .failed:
      guard transitionInFlight else {
        return
      }
      let progress = normalizedProgress(for: gesture)
      interactionController?.update(progress)
      logger.notice("pan cancelled by recognizer progress=\(formatted(progress), privacy: .public)")
      interactionController?.cancel()
    default:
      break
    }
  }

  private func resetInteractiveTransition() {
    interactionController = nil
    activeAnimator = nil
    gestureWindow = nil
    gestureStartY = nil
    gestureReferenceHeight = 1
    lastLoggedProgressBucket = 0
    transitionInFlight = false
  }

  private func normalizedProgress(for gesture: UIPanGestureRecognizer) -> CGFloat {
    guard let gestureWindow,
          let gestureStartY else {
      return 0
    }

    let downwardDistance = max(gesture.location(in: gestureWindow).y - gestureStartY, 0)
    return min(max(downwardDistance / max(gestureReferenceHeight, 1), 0), 1)
  }

  private func logProgressMilestone(_ progress: CGFloat) {
    let bucket = min(Int(progress * 4), 4)
    guard bucket > lastLoggedProgressBucket else {
      return
    }

    lastLoggedProgressBucket = bucket
    logger.info("dismiss normalized progress=\(bucket * 25, privacy: .public)%")
  }

  private func formatted(_ progress: CGFloat) -> String {
    String(format: "%.2f", progress)
  }
}

private final class NativePeekPopViewerDismissAnimator: NSObject,
  UIViewControllerAnimatedTransitioning {
  private let logger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "NativeCardContextMenu",
    category: "PeekPopDismiss"
  )
  private weak var sourceView: UIView?

  init(sourceView: UIView?) {
    self.sourceView = sourceView
    super.init()
  }

  func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval {
    UIAccessibility.isReduceMotionEnabled ? 0.2 : 0.38
  }

  func animateTransition(using transitionContext: UIViewControllerContextTransitioning) {
    guard let fromViewController = transitionContext.viewController(forKey: .from),
          let fromView = transitionContext.view(forKey: .from),
          let toViewController = transitionContext.viewController(forKey: .to),
          let toView = transitionContext.view(forKey: .to) else {
      transitionContext.completeTransition(false)
      return
    }

    let containerView = transitionContext.containerView
    let initialFrame = transitionContext.initialFrame(for: fromViewController)
    let startFrame = initialFrame.isEmpty ? containerView.bounds : initialFrame
    let reduceMotion = UIAccessibility.isReduceMotionEnabled
    let endFrame = dismissalFrame(in: containerView, reduceMotion: reduceMotion)
    logger.notice("dismiss animator started interactive=\(transitionContext.isInteractive, privacy: .public)")

    toView.frame = transitionContext.finalFrame(for: toViewController)
    if toView.superview == nil {
      containerView.insertSubview(toView, belowSubview: fromView)
    } else {
      containerView.sendSubviewToBack(toView)
    }

    fromView.frame = startFrame
    fromView.alpha = 1
    fromView.clipsToBounds = true
    fromView.layer.cornerCurve = .continuous
    fromView.layer.cornerRadius = 0
    let logger = self.logger

    UIView.animate(
      withDuration: transitionDuration(using: transitionContext),
      delay: 0,
      options: [.curveLinear, .beginFromCurrentState],
      animations: {
        fromView.frame = endFrame
        fromView.layer.cornerRadius = reduceMotion ? 0 : 32
        if reduceMotion {
          fromView.alpha = 0
        }
      },
      completion: { finished in
        let completed = finished && !transitionContext.transitionWasCancelled
        if !completed {
          fromView.frame = startFrame
          fromView.alpha = 1
          fromView.layer.cornerRadius = 0
          fromView.clipsToBounds = false
        }
        logger.notice(
          "dismiss transition completed success=\(completed, privacy: .public) animationFinished=\(finished, privacy: .public)"
        )
        transitionContext.completeTransition(completed)
      }
    )
  }

  private func dismissalFrame(in containerView: UIView, reduceMotion: Bool) -> CGRect {
    let bounds = containerView.bounds
    guard !bounds.isEmpty else {
      return bounds
    }

    if reduceMotion {
      return bounds.offsetBy(dx: 0, dy: bounds.height * 0.36)
    }

    if let sourceView,
       let sourceWindow = sourceView.window,
       let containerWindow = containerView.window,
       sourceWindow === containerWindow {
      let sourceFrame = sourceView.convert(sourceView.bounds, to: containerView)
      if !sourceFrame.isEmpty, sourceFrame.intersects(bounds) {
        return sourceFrame
      }
    }

    return bounds.offsetBy(dx: 0, dy: bounds.height)
  }
}
