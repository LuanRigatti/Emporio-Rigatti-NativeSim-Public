import UIKit

final class NativePeekPopInteractiveDismissCoordinator: NSObject,
  UINavigationControllerDelegate,
  UIGestureRecognizerDelegate {
  private weak var navigationController: UINavigationController?
  private weak var viewerController: NativeContextMenuPreviewViewController?
  private weak var scrollView: UIScrollView?
  private weak var gestureView: UIView?
  private weak var dismissPanGesture: UIPanGestureRecognizer?
  private var interactionController: UIPercentDrivenInteractiveTransition?
  private var activeAnimator: NativePeekPopViewerDismissAnimator?
  private var transitionInFlight = false

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
          !transitionInFlight,
          navigationController.topViewController === viewerController else {
      return false
    }

    let velocity = panGesture.velocity(in: viewerController.view)
    let isVerticalDownwardPan = velocity.y > 0 && abs(velocity.y) > abs(velocity.x) * 1.15
    let scrollViewIsAtTop = scrollView.contentOffset.y
      <= -scrollView.adjustedContentInset.top + 1
    return isVerticalDownwardPan && scrollViewIsAtTop
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
    return animator
  }

  func navigationController(
    _ navigationController: UINavigationController,
    interactionControllerFor animationController: UIViewControllerAnimatedTransitioning
  ) -> UIViewControllerInteractiveTransitioning? {
    guard let activeAnimator,
          (animationController as AnyObject) === activeAnimator else {
      return nil
    }
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
        resetInteractiveTransition()
      }
      return
    }

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

    let translation = gesture.translation(in: viewerController.view)
    let height = max(viewerController.view.bounds.height, 1)
    let progress = min(max(translation.y / height, 0), 1)

    switch gesture.state {
    case .began:
      guard !transitionInFlight,
            navigationController.topViewController === viewerController else {
        return
      }
      transitionInFlight = true
      let interaction = UIPercentDrivenInteractiveTransition()
      interaction.completionCurve = .easeOut
      interactionController = interaction
      guard navigationController.popViewController(animated: true) != nil else {
        resetInteractiveTransition()
        return
      }
    case .changed:
      guard transitionInFlight else {
        return
      }
      interactionController?.update(progress)
    case .ended:
      guard transitionInFlight else {
        return
      }
      interactionController?.update(progress)
      let velocity = gesture.velocity(in: viewerController.view).y
      if progress >= 0.34 || (progress >= 0.1 && velocity >= 900) {
        interactionController?.finish()
      } else {
        interactionController?.cancel()
      }
    case .cancelled, .failed:
      guard transitionInFlight else {
        return
      }
      interactionController?.update(progress)
      interactionController?.cancel()
    default:
      break
    }
  }

  private func resetInteractiveTransition() {
    interactionController = nil
    activeAnimator = nil
    transitionInFlight = false
  }
}

private final class NativePeekPopViewerDismissAnimator: NSObject,
  UIViewControllerAnimatedTransitioning {
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
      completion: { _ in
        let completed = !transitionContext.transitionWasCancelled
        if !completed {
          fromView.frame = startFrame
          fromView.alpha = 1
          fromView.layer.cornerRadius = 0
          fromView.clipsToBounds = false
        }
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
