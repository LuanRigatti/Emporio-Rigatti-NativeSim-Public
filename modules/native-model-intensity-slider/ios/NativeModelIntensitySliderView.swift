import ExpoModulesCore
import SwiftUI
import UIKit

private enum ModelIntensityStep: String, CaseIterable {
  case instant
  case medium
  case high

  var label: String {
    switch self {
    case .instant: return "5.5 Instant"
    case .medium: return "5.6 Medium"
    case .high: return "5.6 High"
    }
  }

  var index: Int {
    Self.allCases.firstIndex(of: self) ?? 1
  }

  static func from(index: Int) -> ModelIntensityStep {
    allCases[min(max(index, 0), allCases.count - 1)]
  }
}

private final class NativeModelIntensitySliderModel: ObservableObject {
  @Published var isExpanded = false
  @Published var selectedStep: ModelIntensityStep = .medium
  @Published var colorScheme = "light"
  @Published var accentColorHex = "#0A84FF"
  @Published private(set) var originFrame = CGRect.zero
  @Published private(set) var targetFrame = CGRect.zero
  @Published private(set) var geometryReady = false
  @Published private(set) var transitionCompleted = false
  @Published private(set) var transitionGeneration = 0

  var onStepChange: ((ModelIntensityStep) -> Void)?
  var onTransitionComplete: ((Bool) -> Void)?
  var onInteractionCommitted: ((ModelIntensityStep) -> Void)?
  var onDismissRequest: (() -> Void)?

  private var pendingTransitionGeneration: Int?
  private var dismissRequested = false
  private let selectionFeedback = UISelectionFeedbackGenerator()

  func setExpanded(_ expanded: Bool, animated: Bool) {
    guard isExpanded != expanded else { return }
    transitionGeneration += 1
    let generation = transitionGeneration
    pendingTransitionGeneration = generation
    dismissRequested = !expanded
    transitionCompleted = false

    if animated {
      withAnimation(.spring(response: 0.4, dampingFraction: 0.9)) {
        isExpanded = expanded
      }
    } else {
      isExpanded = expanded
      completeTransitionIfPending(generation)
    }
  }

  func completeTransitionIfPending(_ generation: Int) {
    guard pendingTransitionGeneration == generation else { return }
    pendingTransitionGeneration = nil
    transitionCompleted = isExpanded
    onTransitionComplete?(isExpanded)
  }

  func updateGeometry(origin: CGRect, target: CGRect) {
    guard !geometryReady || originFrame != origin || targetFrame != target else { return }
    originFrame = origin
    targetFrame = target
    geometryReady = true
  }

  var isInteractive: Bool {
    isExpanded && transitionCompleted && geometryReady && !dismissRequested
  }

  func commitInteraction(_ step: ModelIntensityStep) {
    guard isExpanded, !dismissRequested else { return }
    dismissRequested = true
    onInteractionCommitted?(step)
  }

  func requestDismiss() {
    guard isExpanded, !dismissRequested else { return }
    dismissRequested = true
    onDismissRequest?()
  }

  func setSelectedStep(_ step: ModelIntensityStep, notify: Bool = false) {
    guard selectedStep != step else { return }
    selectedStep = step
    guard notify else { return }
    selectionFeedback.selectionChanged()
    selectionFeedback.prepare()
    onStepChange?(step)
  }

  func moveSelection(by delta: Int) {
    setSelectedStep(.from(index: selectedStep.index + delta), notify: true)
  }

  func prepareSelectionFeedback() {
    selectionFeedback.prepare()
  }
}

private struct NativeModelIntensitySliderContent: View {
  @ObservedObject var model: NativeModelIntensitySliderModel
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var trackFrame: CGRect = .zero

  private static let coordinateSpaceName = "model-intensity-overlay"

  private var accentColor: Color {
    Color(hex: model.accentColorHex)
  }

  var body: some View {
    GeometryReader { geometry in
      ZStack {
        if model.geometryReady {
          let sourceFrame = model.originFrame
          let finalShellFrame = SliderGeometry.finalShellFrame(in: model.targetFrame)
          let visibleShellFrame = model.isExpanded ? finalShellFrame : sourceFrame
          let finalLabelCenter = SliderGeometry.labelCenter(in: model.targetFrame)
          let labelCenter = model.isExpanded
            ? finalLabelCenter
            : CGPoint(x: sourceFrame.midX, y: sourceFrame.midY)

          Text(model.selectedStep.label)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.primary)
            .frame(width: model.targetFrame.width, height: SliderGeometry.labelHeight)
            .position(labelCenter)
            .opacity(model.isExpanded ? 1 : 0)
            .id(model.selectedStep)
            .animation(
              reduceMotion ? nil : .easeInOut(duration: 0.14),
              value: model.selectedStep
            )
            .transition(
              reduceMotion
                ? .identity
                : .opacity.combined(with: .scale(scale: 0.985, anchor: .center))
            )

          NativeModelIntensitySliderTrack(
            selectedStep: model.selectedStep,
            accentColor: accentColor,
            colorScheme: model.colorScheme,
            isExpanded: model.isExpanded,
            onDragStart: model.prepareSelectionFeedback,
            onStepChange: { model.setSelectedStep($0, notify: true) },
            onInteractionCommitted: { model.commitInteraction($0) }
          )
          .frame(width: visibleShellFrame.width, height: visibleShellFrame.height)
          .position(x: visibleShellFrame.midX, y: visibleShellFrame.midY)
          .background {
            GeometryReader { trackGeometry in
              Color.clear.preference(
                key: SliderTrackFramePreferenceKey.self,
                value: trackGeometry.frame(in: .named(Self.coordinateSpaceName))
              )
            }
          }
          .opacity(model.geometryReady ? 1 : 0)
          .allowsHitTesting(model.isInteractive)
        }
      }
      .frame(width: geometry.size.width, height: geometry.size.height)
      .animation(
        reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.9),
        value: model.isExpanded
      )
    }
    .ignoresSafeArea()
    .contentShape(Rectangle())
    .coordinateSpace(name: Self.coordinateSpaceName)
    .onPreferenceChange(SliderTrackFramePreferenceKey.self) { trackFrame = $0 }
    .simultaneousGesture(
      SpatialTapGesture(coordinateSpace: .named(Self.coordinateSpaceName))
        .onEnded { event in
          guard model.isExpanded, !trackFrame.contains(event.location) else { return }
          model.requestDismiss()
        }
    )
    .preferredColorScheme(model.colorScheme == "dark" ? .dark : .light)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Intensidade do modelo")
    .accessibilityValue(model.selectedStep.label)
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        model.moveSelection(by: 1)
      case .decrement:
        model.moveSelection(by: -1)
      @unknown default:
        break
      }
    }
    .accessibilityAction(.escape) { model.requestDismiss() }
    .accessibilityHidden(!model.isExpanded)
    .modifier(
      AnimationCompletionObserver(
        value: model.isExpanded ? 1 : 0,
        generation: model.transitionGeneration,
        onCompletion: { model.completeTransitionIfPending($0) }
      )
    )
  }
}

private enum SliderGeometry {
  static let shellHeight: CGFloat = 58
  static let railHorizontalInset: CGFloat = 10
  static let railVerticalInset: CGFloat = 9
  static let railHeight: CGFloat = 40
  static let thumbDiameter: CGFloat = 36
  static let markerDiameter: CGFloat = 2.5
  static let labelHeight: CGFloat = 21
  static let labelGap: CGFloat = 4
  static let maximumOuterOverscroll: CGFloat = 10
  static let maximumInnerOverscroll: CGFloat = 22

  static func finalShellFrame(in target: CGRect) -> CGRect {
    let groupHeight = labelHeight + labelGap + shellHeight
    let topInset = max((target.height - groupHeight) / 2, 0)
    return CGRect(
      x: target.minX,
      y: target.minY + topInset + labelHeight + labelGap,
      width: target.width,
      height: shellHeight
    )
  }

  static func labelCenter(in target: CGRect) -> CGPoint {
    let groupHeight = labelHeight + labelGap + shellHeight
    let topInset = max((target.height - groupHeight) / 2, 0)
    return CGPoint(x: target.midX, y: target.minY + topInset + labelHeight / 2)
  }
}

private struct SliderTrackFramePreferenceKey: PreferenceKey {
  static let defaultValue = CGRect.zero

  static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
    let next = nextValue()
    if next != .zero {
      value = next
    }
  }
}

private struct NativeModelIntensitySliderTrack: View {
  let selectedStep: ModelIntensityStep
  let accentColor: Color
  let colorScheme: String
  let isExpanded: Bool
  let onDragStart: () -> Void
  let onStepChange: (ModelIntensityStep) -> Void
  let onInteractionCommitted: (ModelIntensityStep) -> Void

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var rawDragProgress: CGFloat = 0.5
  @State private var isDragging = false
  @State private var isSnapping = false
  @State private var snapAnimationValue: CGFloat = 0
  @State private var snapGeneration = 0
  @State private var pendingCommitStep: ModelIntensityStep?
  @State private var pendingCommitGeneration: Int?

  private var isGestureActive: Bool {
    isDragging || isSnapping
  }

  private var logicalProgress: CGFloat {
    let selectedProgress = CGFloat(selectedStep.index) / 2
    return clamp(isGestureActive ? rawDragProgress : selectedProgress, to: 0...1)
  }

  var body: some View {
    GeometryReader { geometry in
      let width = geometry.size.width
      let height = geometry.size.height
      let baseRailWidth = max(width - SliderGeometry.railHorizontalInset * 2, 0)
      let rawForVisuals = isGestureActive ? rawDragProgress : logicalProgress
      let overscroll = overscrollDistance(rawForVisuals, available: max(baseRailWidth - SliderGeometry.thumbDiameter, 1))
      let outerLeadingStretch = overscroll.direction < 0 ? overscroll.outer : 0
      let outerTrailingStretch = overscroll.direction > 0 ? overscroll.outer : 0
      let innerLeadingStretch = overscroll.direction < 0 ? overscroll.inner : 0
      let innerTrailingStretch = overscroll.direction > 0 ? overscroll.inner : 0
      let railX = SliderGeometry.railHorizontalInset - innerLeadingStretch
      let railWidth = baseRailWidth + innerLeadingStretch + innerTrailingStretch
      let railHeight = min(SliderGeometry.railHeight, max(height - SliderGeometry.railVerticalInset * 2, 0))
      let thumbCenter = railX + SliderGeometry.thumbDiameter / 2 + logicalProgress * max(railWidth - SliderGeometry.thumbDiameter, 0)
      let fillWidth = max(thumbCenter - railX, SliderGeometry.thumbDiameter / 2)
      let shellHeight = min(SliderGeometry.shellHeight, height)

      ZStack(alignment: .leading) {
        trackShell(width: width + outerLeadingStretch + outerTrailingStretch, height: shellHeight)
          .offset(x: -outerLeadingStretch)

        innerRail(
          width: railWidth,
          height: railHeight,
          progress: logicalProgress,
          fillWidth: fillWidth,
          thumbCenter: thumbCenter,
          leadingOffset: railX
        )
        .frame(width: railWidth, height: railHeight)
        .offset(x: railX, y: (height - railHeight) / 2)
        .opacity(isExpanded ? 1 : 0)
        .allowsHitTesting(isExpanded)
      }
      .frame(width: width, height: height)
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
          .onChanged { event in
            if !isDragging {
              snapGeneration += 1
              pendingCommitStep = nil
              pendingCommitGeneration = nil
              isSnapping = false
              isDragging = true
              onDragStart()
            }

            let progress = rawProgress(for: event.location.x, railWidth: baseRailWidth)
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
              rawDragProgress = progress
            }
            onStepChange(.from(index: Int((clamp(progress, to: 0...1) * 2).rounded())))
          }
          .onEnded { event in
            let progress = clamp(rawProgress(for: event.location.x, railWidth: baseRailWidth), to: 0...1)
            let step = ModelIntensityStep.from(index: Int((progress * 2).rounded()))
            onStepChange(step)
            snapGeneration += 1
            let generation = snapGeneration
            pendingCommitStep = step
            pendingCommitGeneration = generation
            let target = CGFloat(step.index) / 2

            if reduceMotion {
              var transaction = Transaction()
              transaction.disablesAnimations = true
              withTransaction(transaction) {
                rawDragProgress = target
                isDragging = false
                isSnapping = true
                snapAnimationValue = CGFloat(generation)
              }
              completeSnapIfPending(generation)
            } else {
              withAnimation(.spring(response: 0.34, dampingFraction: 0.93)) {
                rawDragProgress = target
                isDragging = false
                isSnapping = true
                snapAnimationValue = CGFloat(generation)
              }
            }
          }
      )
    }
    .modifier(
      AnimationCompletionObserver(
        value: snapAnimationValue,
        generation: snapGeneration,
        onCompletion: completeSnapIfPending
      )
    )
    .accessibilityHidden(true)
  }

  private func innerRail(
    width: CGFloat,
    height: CGFloat,
    progress: CGFloat,
    fillWidth: CGFloat,
    thumbCenter: CGFloat,
    leadingOffset: CGFloat
  ) -> some View {
    ZStack(alignment: .leading) {
      Capsule()
        .fill(.ultraThinMaterial)
        .overlay {
          Capsule().fill(Color.black.opacity(colorScheme == "dark" ? 0.48 : 0.34))
        }
        .overlay {
          Capsule().strokeBorder(Color.white.opacity(colorScheme == "dark" ? 0.16 : 0.22), lineWidth: 0.7)
        }

      Capsule()
        .fill(
          LinearGradient(
            colors: [accentColor.opacity(0.96), accentColor],
            startPoint: .leading,
            endPoint: .trailing
          )
        )
        .frame(width: min(fillWidth, width), height: height)
        .overlay {
          Capsule().strokeBorder(Color.white.opacity(0.18), lineWidth: 0.6)
        }

      ForEach(ModelIntensityStep.allCases, id: \.rawValue) { step in
        Circle()
          .fill(Color.white.opacity(CGFloat(step.index) / 2 <= progress ? 0.34 : 0.56))
          .frame(width: SliderGeometry.markerDiameter, height: SliderGeometry.markerDiameter)
          .position(
            x: SliderGeometry.thumbDiameter / 2 + CGFloat(step.index) / 2 * max(width - SliderGeometry.thumbDiameter, 0),
            y: height / 2
          )
          .accessibilityHidden(true)
      }

      Circle()
        .fill(
          LinearGradient(
            colors: [Color.white, Color.white.opacity(0.9)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
        .frame(width: SliderGeometry.thumbDiameter, height: SliderGeometry.thumbDiameter)
        .overlay {
          Circle().strokeBorder(Color.black.opacity(0.07), lineWidth: 0.7)
        }
        .shadow(color: .black.opacity(colorScheme == "dark" ? 0.24 : 0.14), radius: 2, x: 0, y: 1)
        .scaleEffect(x: isDragging ? 1.035 : 1, y: isDragging ? 0.985 : 1)
        .position(x: thumbCenter - leadingOffset, y: height / 2)
        .accessibilityHidden(true)
    }
    .clipShape(Capsule())
  }

  @ViewBuilder
  private func trackShell(width: CGFloat, height: CGFloat) -> some View {
    if #available(iOS 26.0, *) {
      Capsule()
        .fill(Color.clear)
        .frame(width: width, height: height)
        .glassEffect(.regular.interactive(), in: Capsule())
        .overlay {
          Capsule().strokeBorder(shellRim, lineWidth: 0.7)
        }
        .shadow(color: .black.opacity(colorScheme == "dark" ? 0.12 : 0.08), radius: 2, x: 0, y: 1)
    } else {
      Capsule()
        .fill(.ultraThinMaterial)
        .frame(width: width, height: height)
        .overlay {
          Capsule().strokeBorder(shellRim, lineWidth: 0.7)
        }
    }
  }

  private var shellRim: LinearGradient {
    LinearGradient(
      colors: [
        Color.white.opacity(colorScheme == "dark" ? 0.42 : 0.7),
        Color.white.opacity(colorScheme == "dark" ? 0.14 : 0.32),
      ],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }

  private func rawProgress(for locationX: CGFloat, railWidth: CGFloat) -> CGFloat {
    let available = max(railWidth - SliderGeometry.thumbDiameter, 1)
    return (locationX - SliderGeometry.railHorizontalInset - SliderGeometry.thumbDiameter / 2) / available
  }

  private func overscrollDistance(_ raw: CGFloat, available: CGFloat) -> (direction: CGFloat, outer: CGFloat, inner: CGFloat) {
    let overshoot = raw < 0 ? raw * available : (raw > 1 ? (raw - 1) * available : 0)
    let distance = abs(overshoot)
    guard distance > 0 else { return (0, 0, 0) }
    return (
      overshoot < 0 ? -1 : 1,
      resisted(distance, maximum: SliderGeometry.maximumOuterOverscroll),
      resisted(distance, maximum: SliderGeometry.maximumInnerOverscroll)
    )
  }

  private func resisted(_ distance: CGFloat, maximum: CGFloat) -> CGFloat {
    maximum * (1 - exp(-distance / maximum))
  }

  private func clamp(_ value: CGFloat, to range: ClosedRange<CGFloat>) -> CGFloat {
    min(max(value, range.lowerBound), range.upperBound)
  }

  private func completeSnapIfPending(_ generation: Int) {
    guard pendingCommitGeneration == generation, let step = pendingCommitStep else { return }
    pendingCommitGeneration = nil
    pendingCommitStep = nil
    isSnapping = false
    onInteractionCommitted(step)
  }
}

private struct AnimationCompletionObserver: ViewModifier, Animatable {
  var value: CGFloat
  let target: CGFloat
  let generation: Int
  let onCompletion: (Int) -> Void

  var animatableData: CGFloat {
    get { value }
    set {
      value = newValue
      guard abs(newValue - target) < 0.001 else { return }
      let generation = generation
      let onCompletion = onCompletion
      DispatchQueue.main.async { onCompletion(generation) }
    }
  }

  init(value: CGFloat, generation: Int, onCompletion: @escaping (Int) -> Void) {
    self.value = value
    self.target = value
    self.generation = generation
    self.onCompletion = onCompletion
  }

  func body(content: Content) -> some View {
    content
  }
}

private extension Color {
  init(hex: String) {
    let normalized = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: normalized).scanHexInt64(&value)
    self.init(
      .sRGB,
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255,
      opacity: 1
    )
  }
}

public final class NativeModelIntensitySliderView: ExpoView {
  private let model = NativeModelIntensitySliderModel()
  private var hostingController: UIHostingController<NativeModelIntensitySliderContent>?
  private var pendingExpandedValue: Bool?
  private var originViewTag: Int?
  private var targetViewTag: Int?
  private var geometryRevision = 0

  public let onStepChange = EventDispatcher()
  public let onTransitionComplete = EventDispatcher()
  public let onInteractionCommitted = EventDispatcher()
  public let onDismissRequest = EventDispatcher()
  public let onGeometryReady = EventDispatcher()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear

    model.onStepChange = { [weak self] step in
      self?.onStepChange(["step": step.rawValue])
    }
    model.onTransitionComplete = { [weak self] expanded in
      self?.onTransitionComplete(["expanded": expanded])
    }
    model.onInteractionCommitted = { [weak self] step in
      self?.onInteractionCommitted(["step": step.rawValue])
    }
    model.onDismissRequest = { [weak self] in
      self?.onDismissRequest([:])
    }

    let controller = UIHostingController(rootView: NativeModelIntensitySliderContent(model: model))
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    hostingController = controller
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    refreshMeasuredFrames()
    applyPendingExpandedValueIfPossible()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    refreshMeasuredFrames()
    applyPendingExpandedValueIfPossible()
  }

  public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard model.isInteractive, model.targetFrame.insetBy(dx: -2, dy: -2).contains(point) else {
      return nil
    }
    return super.hitTest(point, with: event)
  }

  func setExpanded(_ expanded: Bool) {
    if expanded {
      guard !model.isExpanded else { return }
      pendingExpandedValue = true
      refreshMeasuredFrames()
      applyPendingExpandedValueIfPossible()
      return
    }

    if pendingExpandedValue == true && !model.isExpanded {
      pendingExpandedValue = nil
      onTransitionComplete(["expanded": false])
      return
    }

    guard model.isExpanded else { return }
    pendingExpandedValue = false
    applyPendingExpandedValueIfPossible()
  }

  func setOriginViewTag(_ tag: Int) {
    originViewTag = tag > 0 ? tag : nil
    refreshMeasuredFrames()
    applyPendingExpandedValueIfPossible()
  }

  func setTargetViewTag(_ tag: Int) {
    targetViewTag = tag > 0 ? tag : nil
    refreshMeasuredFrames()
    applyPendingExpandedValueIfPossible()
  }

  func setGeometryRevision(_ revision: Int) {
    guard geometryRevision != revision else { return }
    geometryRevision = revision
    refreshMeasuredFrames()
    applyPendingExpandedValueIfPossible()
  }

  func setSelectedStep(_ value: String) {
    guard let step = ModelIntensityStep(rawValue: value) else { return }
    model.setSelectedStep(step)
  }

  func setColorScheme(_ colorScheme: String) {
    model.colorScheme = colorScheme == "dark" ? "dark" : "light"
  }

  func setAccentColor(_ accentColor: String) {
    model.accentColorHex = accentColor
  }

  private func applyPendingExpandedValueIfPossible() {
    guard let expanded = pendingExpandedValue, window != nil else { return }
    guard !expanded || model.geometryReady else { return }
    pendingExpandedValue = nil

    if !expanded && !model.isExpanded {
      onTransitionComplete(["expanded": false])
      return
    }

    model.setExpanded(expanded, animated: !UIAccessibility.isReduceMotionEnabled)
  }

  private func refreshMeasuredFrames() {
    guard
      bounds.width > 0,
      bounds.height > 0,
      let hostWindow = window,
      let originViewTag,
      let targetViewTag,
      let originView = appContext?.findView(withTag: originViewTag, ofType: UIView.self),
      let targetView = appContext?.findView(withTag: targetViewTag, ofType: UIView.self),
      let originFrame = frame(of: originView, in: hostWindow),
      let targetFrame = frame(of: targetView, in: hostWindow),
      originFrame.width > 0,
      originFrame.height > 0,
      targetFrame.width > 0,
      targetFrame.height > 0
    else {
      return
    }

    guard !isNearlyEqual(model.originFrame, originFrame) || !isNearlyEqual(model.targetFrame, targetFrame) else {
      return
    }

    let wasReady = model.geometryReady
    model.updateGeometry(origin: originFrame, target: targetFrame)
    if !wasReady {
      onGeometryReady(["ready": true])
    }
  }

  private func frame(of view: UIView, in hostWindow: UIWindow) -> CGRect? {
    guard let sourceWindow = view.window, sourceWindow.screen === hostWindow.screen else { return nil }

    let rectInSourceWindow = view.convert(view.bounds, to: sourceWindow)
    let rectOnScreen = sourceWindow.convert(rectInSourceWindow, to: nil)
    let rectInHostWindow = hostWindow.convert(rectOnScreen, from: nil)
    return convert(rectInHostWindow, from: hostWindow)
  }

  private func isNearlyEqual(_ lhs: CGRect, _ rhs: CGRect) -> Bool {
    let tolerance: CGFloat = 0.25
    return abs(lhs.minX - rhs.minX) < tolerance
      && abs(lhs.minY - rhs.minY) < tolerance
      && abs(lhs.width - rhs.width) < tolerance
      && abs(lhs.height - rhs.height) < tolerance
  }
}
