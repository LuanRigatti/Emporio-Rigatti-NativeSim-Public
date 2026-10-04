import ExpoModulesCore
import UIKit

enum IntensityDebugLogger {
  static func log(_ flow: String, _ message: @autoclosure () -> String) {
    #if DEBUG
      NSLog("%@", "[IntensityDebug][\(flow)] \(message())")
    #endif
  }

  static func describeWindow(_ window: UIWindow?) -> String {
    guard let window else { return "nil" }
    let sceneID = window.windowScene?.session.persistentIdentifier ?? "nil"
    return "class=\(NSStringFromClass(type(of: window))) id=\(ObjectIdentifier(window)) scene=\(sceneID) screen=\(ObjectIdentifier(window.screen)) screenBounds=\(window.screen.bounds) bounds=\(window.bounds) safeArea=\(window.safeAreaInsets) key=\(window.isKeyWindow) hidden=\(window.isHidden) alpha=\(window.alpha)"
  }

  static func describeView(_ view: UIView?) -> String {
    guard let view else { return "nil" }
    return "class=\(NSStringFromClass(type(of: view))) id=\(ObjectIdentifier(view)) tag=\(view.tag) bounds=\(view.bounds) frame=\(view.frame) safeArea=\(view.safeAreaInsets) hidden=\(view.isHidden) alpha=\(view.alpha) clips=\(view.clipsToBounds) window={\(describeWindow(view.window))}"
  }

  static func isFinite(_ rect: CGRect) -> Bool {
    rect.origin.x.isFinite && rect.origin.y.isFinite && rect.size.width.isFinite
      && rect.size.height.isFinite
  }

  static func sameWindowScene(_ first: UIWindow, _ second: UIWindow) -> Bool {
    guard let firstScene = first.windowScene, let secondScene = second.windowScene else {
      return false
    }
    return firstScene === secondScene
  }
}

struct IntensityScreenGeometry {
  let coordinateBounds: CGRect
  let fixedCoordinateBounds: CGRect
  let nativeBounds: CGRect
  let scale: CGFloat
  let nativeScale: CGFloat

  init(screen: UIScreen) {
    self.init(
      coordinateBounds: screen.coordinateSpace.bounds,
      fixedCoordinateBounds: screen.fixedCoordinateSpace.bounds,
      nativeBounds: screen.nativeBounds,
      scale: screen.scale,
      nativeScale: screen.nativeScale
    )
  }

  init(
    coordinateBounds: CGRect,
    fixedCoordinateBounds: CGRect,
    nativeBounds: CGRect,
    scale: CGFloat,
    nativeScale: CGFloat
  ) {
    self.coordinateBounds = coordinateBounds
    self.fixedCoordinateBounds = fixedCoordinateBounds
    self.nativeBounds = nativeBounds
    self.scale = scale
    self.nativeScale = nativeScale
  }

  var diagnosticDescription: String {
    "coordinateBounds=\(coordinateBounds) fixedCoordinateBounds=\(fixedCoordinateBounds) nativeBounds=\(nativeBounds) scale=\(scale) nativeScale=\(nativeScale)"
  }

  func incompatibilityReason(with other: IntensityScreenGeometry) -> String? {
    guard Self.isUsable(coordinateBounds), Self.isUsable(other.coordinateBounds) else {
      return "current coordinate-space bounds are unavailable source=\(coordinateBounds) destination=\(other.coordinateBounds)"
    }
    if !Self.matches(coordinateBounds, other.coordinateBounds, tolerance: 0.5) {
      return "coordinate-space bounds differ source=\(coordinateBounds) destination=\(other.coordinateBounds)"
    }
    guard Self.isUsable(fixedCoordinateBounds), Self.isUsable(other.fixedCoordinateBounds) else {
      return "fixed coordinate-space bounds are unavailable source=\(fixedCoordinateBounds) destination=\(other.fixedCoordinateBounds)"
    }
    if !Self.matches(fixedCoordinateBounds, other.fixedCoordinateBounds, tolerance: 0.5) {
      return "fixed coordinate-space bounds differ source=\(fixedCoordinateBounds) destination=\(other.fixedCoordinateBounds)"
    }
    // Remote keyboard screens may not expose native metrics; compare them when both are available.
    if Self.isUsable(nativeBounds), Self.isUsable(other.nativeBounds),
      !Self.matches(nativeBounds, other.nativeBounds, tolerance: 1)
    {
      return "native display bounds differ source=\(nativeBounds) destination=\(other.nativeBounds)"
    }
    if Self.isUsableScale(scale), Self.isUsableScale(other.scale), abs(scale - other.scale) > 0.001 {
      return "display scale differs source=\(scale) destination=\(other.scale)"
    }
    if Self.isUsableScale(nativeScale), Self.isUsableScale(other.nativeScale),
      abs(nativeScale - other.nativeScale) > 0.001
    {
      return "native display scale differs source=\(nativeScale) destination=\(other.nativeScale)"
    }
    return nil
  }

  private static func isUsable(_ rect: CGRect) -> Bool {
    rect.origin.x.isFinite && rect.origin.y.isFinite && rect.width.isFinite && rect.height.isFinite
      && rect.width > 0 && rect.height > 0
  }

  private static func isUsableScale(_ value: CGFloat) -> Bool {
    value.isFinite && value > 0
  }

  private static func matches(_ lhs: CGRect, _ rhs: CGRect, tolerance: CGFloat) -> Bool {
    abs(lhs.minX - rhs.minX) <= tolerance
      && abs(lhs.minY - rhs.minY) <= tolerance
      && abs(lhs.width - rhs.width) <= tolerance
      && abs(lhs.height - rhs.height) <= tolerance
  }
}

struct IntensityScreenRectConversion {
  let sourceScreenRect: CGRect
  let destinationWindowRect: CGRect
}

enum IntensityCoordinateConverter {
  static func incompatibilityReason(sourceScreen: UIScreen, destinationScreen: UIScreen) -> String? {
    IntensityScreenGeometry(screen: sourceScreen)
      .incompatibilityReason(with: IntensityScreenGeometry(screen: destinationScreen))
  }

  static func convertRect(
    _ rectInSourceWindow: CGRect,
    from sourceWindow: UIWindow,
    to destinationWindow: UIWindow
  ) -> IntensityScreenRectConversion? {
    guard
      IntensityDebugLogger.isFinite(rectInSourceWindow),
      incompatibilityReason(sourceScreen: sourceWindow.screen, destinationScreen: destinationWindow.screen) == nil
    else {
      return nil
    }

    let sourceScreenRect = sourceWindow.screen.coordinateSpace.convert(rectInSourceWindow, from: sourceWindow)
    guard IntensityDebugLogger.isFinite(sourceScreenRect) else { return nil }

    // Once display geometry is verified, screen-point coordinates are a safe bridge
    // between the app window and the remote keyboard window's distinct screen object.
    let destinationWindowRect = destinationWindow.screen.coordinateSpace.convert(sourceScreenRect, to: destinationWindow)
    guard IntensityDebugLogger.isFinite(destinationWindowRect) else { return nil }

    return IntensityScreenRectConversion(
      sourceScreenRect: sourceScreenRect,
      destinationWindowRect: destinationWindowRect
    )
  }

  static func convertScreenPoint(
    _ pointInSourceScreen: CGPoint,
    from sourceScreen: UIScreen,
    to destinationWindow: UIWindow
  ) -> CGPoint? {
    guard
      pointInSourceScreen.x.isFinite,
      pointInSourceScreen.y.isFinite,
      incompatibilityReason(sourceScreen: sourceScreen, destinationScreen: destinationWindow.screen) == nil
    else {
      return nil
    }

    // The compatibility check establishes equivalent logical display coordinates;
    // only then is the screen point interpreted in the destination screen space.
    let destinationWindowPoint = destinationWindow.screen.coordinateSpace.convert(
      pointInSourceScreen,
      to: destinationWindow
    )
    guard destinationWindowPoint.x.isFinite, destinationWindowPoint.y.isFinite else { return nil }
    return destinationWindowPoint
  }
}

enum NativeSendHoldPhase: Equatable {
  case began
  case changed
  case ended
  case cancelled
}

struct NativeSendHoldSample {
  let sessionId: String
  let phase: NativeSendHoldPhase
  let locationOnScreen: CGPoint
  let sourceScreen: UIScreen
}

final class NativeModelIntensitySendGestureCoordinator: NSObject, UIGestureRecognizerDelegate {
  static let shared = NativeModelIntensitySendGestureCoordinator()

  private weak var sendView: UIView?
  private weak var holdRecognizer: UILongPressGestureRecognizer?
  private var registeredViewTag: Int?
  private var activeStartSample: NativeSendHoldSample?
  private var activeSample: NativeSendHoldSample?
  private var observedSessionId: String?
  private var sampleHandler: ((NativeSendHoldSample) -> Void)?
  private var eventHandler: ((String, [String: Any]) -> Void)?
  private var pendingRecognizerEnabled: Bool?

  func registerSendButton(
    viewTag: Int,
    enabled: Bool,
    appContext: AppContext?,
    eventHandler: @escaping (String, [String: Any]) -> Void
  ) {
    DispatchQueue.main.async { [weak self] in
      guard
        let self,
        let sendView = appContext?.findView(withTag: viewTag, ofType: UIView.self)
      else {
        return
      }

      self.eventHandler = eventHandler
      if self.registeredViewTag == viewTag, self.sendView === sendView, let recognizer = self.holdRecognizer {
        if recognizer.state == .began || recognizer.state == .changed {
          self.pendingRecognizerEnabled = enabled
        } else {
          self.pendingRecognizerEnabled = nil
          recognizer.isEnabled = enabled
        }
        return
      }

      self.cancelActiveSession()
      self.removeRecognizer()
      let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(self.handleHold(_:)))
      recognizer.minimumPressDuration = 0.42
      recognizer.allowableMovement = 12
      recognizer.cancelsTouchesInView = true
      recognizer.delaysTouchesBegan = false
      recognizer.delaysTouchesEnded = false
      recognizer.delegate = self
      recognizer.isEnabled = enabled
      sendView.addGestureRecognizer(recognizer)

      self.sendView = sendView
      self.holdRecognizer = recognizer
      self.registeredViewTag = viewTag
    }
  }

  func unregisterSendButton(viewTag: Int) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      guard self.registeredViewTag == viewTag else { return }
      self.cancelActiveSession()
      self.removeRecognizer()
      self.eventHandler = nil
    }
  }

  func observe(sessionId: String, handler: @escaping (NativeSendHoldSample) -> Void) {
    DispatchQueue.main.async { [weak self] in
      guard
        let self,
        let startSample = self.activeStartSample,
        startSample.sessionId == sessionId,
        let latestSample = self.activeSample,
        latestSample.sessionId == sessionId
      else {
        return
      }
      self.observedSessionId = sessionId
      self.sampleHandler = handler
      handler(startSample)
      if latestSample.phase != .began {
        handler(latestSample)
      }
      if Self.isTerminal(latestSample.phase) {
        self.clearObservedSession(sessionId)
      }
    }
  }

  func stopObserving(sessionId: String) {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.observedSessionId == sessionId else { return }
      self.sampleHandler = nil
      self.observedSessionId = nil
    }
  }

  func cancel(sessionId: String) {
    DispatchQueue.main.async { [weak self] in
      guard
        let self,
        let sample = self.activeSample,
        sample.sessionId == sessionId,
        !Self.isTerminal(sample.phase)
      else {
        return
      }
      self.publish(
        NativeSendHoldSample(
          sessionId: sessionId,
          phase: .cancelled,
          locationOnScreen: sample.locationOnScreen,
          sourceScreen: sample.sourceScreen
        )
      )
      self.eventHandler?("onSendHoldCancelled", ["sessionId": sessionId])
    }
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    guard gestureRecognizer === holdRecognizer else { return false }
    return true
  }

  @objc private func handleHold(_ recognizer: UILongPressGestureRecognizer) {
    guard
      recognizer === holdRecognizer,
      let sendView,
      let viewTag = registeredViewTag,
      let window = sendView.window
    else {
      return
    }

    let pointInWindow = recognizer.location(in: window)
    let locationOnScreen = window.screen.coordinateSpace.convert(pointInWindow, from: window)

    switch recognizer.state {
    case .began:
      let sessionId = UUID().uuidString
      let sample = NativeSendHoldSample(
        sessionId: sessionId,
        phase: .began,
        locationOnScreen: locationOnScreen,
        sourceScreen: window.screen
      )
      activeStartSample = sample
      activeSample = sample
      eventHandler?("onSendHoldBegan", ["sessionId": sessionId, "sendButtonTag": viewTag])
      publish(sample)
    case .changed:
      guard let activeSample, !Self.isTerminal(activeSample.phase) else { return }
      publish(
        NativeSendHoldSample(
          sessionId: activeSample.sessionId,
          phase: .changed,
          locationOnScreen: locationOnScreen,
          sourceScreen: activeSample.sourceScreen
        )
      )
    case .ended:
      guard let activeSample, !Self.isTerminal(activeSample.phase) else {
        applyPendingRecognizerEnabledState()
        return
      }
      let sessionId = activeSample.sessionId
      publish(
        NativeSendHoldSample(
          sessionId: sessionId,
          phase: .ended,
          locationOnScreen: locationOnScreen,
          sourceScreen: activeSample.sourceScreen
        )
      )
      applyPendingRecognizerEnabledState()
    case .cancelled, .failed:
      guard let activeSample, !Self.isTerminal(activeSample.phase) else {
        applyPendingRecognizerEnabledState()
        return
      }
      let sessionId = activeSample.sessionId
      publish(
        NativeSendHoldSample(
          sessionId: sessionId,
          phase: .cancelled,
          locationOnScreen: locationOnScreen,
          sourceScreen: activeSample.sourceScreen
        )
      )
      eventHandler?("onSendHoldCancelled", ["sessionId": sessionId])
      applyPendingRecognizerEnabledState()
    default:
      break
    }
  }

  private func publish(_ sample: NativeSendHoldSample) {
    activeSample = sample
    guard observedSessionId == sample.sessionId else { return }
    sampleHandler?(sample)
    if Self.isTerminal(sample.phase) {
      clearObservedSession(sample.sessionId)
    }
  }

  private func clearObservedSession(_ sessionId: String) {
    guard observedSessionId == sessionId else { return }
    sampleHandler = nil
    observedSessionId = nil
    activeStartSample = nil
    activeSample = nil
  }

  private func cancelActiveSession() {
    guard let sample = activeSample else { return }
    guard !Self.isTerminal(sample.phase) else {
      activeStartSample = nil
      activeSample = nil
      return
    }
    publish(
      NativeSendHoldSample(
        sessionId: sample.sessionId,
        phase: .cancelled,
        locationOnScreen: sample.locationOnScreen,
        sourceScreen: sample.sourceScreen
      )
    )
    eventHandler?("onSendHoldCancelled", ["sessionId": sample.sessionId])
  }

  private func removeRecognizer() {
    if let holdRecognizer {
      sendView?.removeGestureRecognizer(holdRecognizer)
    }
    holdRecognizer = nil
    sendView = nil
    registeredViewTag = nil
    pendingRecognizerEnabled = nil
  }

  private func applyPendingRecognizerEnabledState() {
    guard let enabled = pendingRecognizerEnabled, let holdRecognizer else { return }
    pendingRecognizerEnabled = nil
    holdRecognizer.isEnabled = enabled
  }

  private static func isTerminal(_ phase: NativeSendHoldPhase) -> Bool {
    phase == .ended || phase == .cancelled
  }
}

public class NativeModelIntensitySliderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeModelIntensitySlider")

    Events("onSendHoldBegan", "onSendHoldCancelled")

    Function("registerSendButton") { (viewTag: Int, enabled: Bool) in
      NativeModelIntensitySendGestureCoordinator.shared.registerSendButton(
        viewTag: viewTag,
        enabled: enabled,
        appContext: self.appContext
      ) { [weak self] eventName, payload in
        self?.sendEvent(eventName, payload)
      }
    }

    Function("unregisterSendButton") { (viewTag: Int) in
      NativeModelIntensitySendGestureCoordinator.shared.unregisterSendButton(viewTag: viewTag)
    }

    Function("cancelSendGesture") { (sessionId: String) in
      NativeModelIntensitySendGestureCoordinator.shared.cancel(sessionId: sessionId)
    }

    View(NativeModelIntensitySliderView.self) {
      Prop("expanded") { (view: NativeModelIntensitySliderView, expanded: Bool) in
        view.setExpanded(expanded)
      }

      Prop("selectedStep") { (view: NativeModelIntensitySliderView, step: String) in
        view.setSelectedStep(step)
      }

      Prop("colorScheme") { (view: NativeModelIntensitySliderView, colorScheme: String) in
        view.setColorScheme(colorScheme)
      }

      Prop("accentColor") { (view: NativeModelIntensitySliderView, accentColor: String) in
        view.setAccentColor(accentColor)
      }

      Prop("originViewTag") { (view: NativeModelIntensitySliderView, tag: Int) in
        view.setOriginViewTag(tag)
      }

      Prop("targetViewTag") { (view: NativeModelIntensitySliderView, tag: Int) in
        view.setTargetViewTag(tag)
      }

      Prop("geometryRevision") { (view: NativeModelIntensitySliderView, revision: Int) in
        view.setGeometryRevision(revision)
      }

      Events(
        "onStepChange",
        "onTransitionComplete",
        "onInteractionCommitted",
        "onDismissRequest",
        "onGeometryReady"
      )
    }

    View(NativeSendIntelligencePickerView.self) {
      Prop("expanded") { (view: NativeSendIntelligencePickerView, expanded: Bool) in
        view.setExpanded(expanded)
      }

      Prop("selectedStep") { (view: NativeSendIntelligencePickerView, step: String) in
        view.setSelectedStep(step)
      }

      Prop("colorScheme") { (view: NativeSendIntelligencePickerView, colorScheme: String) in
        view.setColorScheme(colorScheme)
      }

      Prop("accentColor") { (view: NativeSendIntelligencePickerView, accentColor: String) in
        view.setAccentColor(accentColor)
      }

      Prop("sendSurfaceColor") { (view: NativeSendIntelligencePickerView, color: String) in
        view.setSendSurfaceColor(color)
      }

      Prop("sendContentColor") { (view: NativeSendIntelligencePickerView, color: String) in
        view.setSendContentColor(color)
      }

      Prop("originViewTag") { (view: NativeSendIntelligencePickerView, tag: Int) in
        view.setOriginViewTag(tag)
      }

      Prop("targetViewTag") { (view: NativeSendIntelligencePickerView, tag: Int) in
        view.setTargetViewTag(tag)
      }

      Prop("interactionSessionId") { (view: NativeSendIntelligencePickerView, sessionId: String?) in
        view.setInteractionSessionId(sessionId)
      }

      Prop("geometryRevision") { (view: NativeSendIntelligencePickerView, revision: Int) in
        view.setGeometryRevision(revision)
      }

      Events(
        "onStepChange",
        "onTransitionComplete",
        "onInteractionCommitted",
        "onDismissRequest",
        "onGeometryReady",
        "onHostDetached"
      )
    }
  }
}
