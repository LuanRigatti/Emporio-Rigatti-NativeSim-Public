import ExpoModulesCore
import SwiftUI
import UIKit

enum ModelIntensityStep: String, CaseIterable {
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

  var pickerLabel: String {
    switch self {
    case .instant: return "Instant"
    case .medium: return "Thinking"
    case .high: return "Extended"
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
  private var lastLoggedPresentationMilestone: Int?
  private var lastIgnoredCompletionGeneration: Int?
  private let stepImpactFeedback = UIImpactFeedbackGenerator(style: .light)

  func setExpanded(_ expanded: Bool, animated: Bool) {
    IntensityDebugLogger.log(
      "horizontal",
      "model expanded received value=\(expanded) current=\(isExpanded) geometryReady=\(geometryReady) transitionCompleted=\(transitionCompleted) animated=\(animated)"
    )
    guard isExpanded != expanded else {
      IntensityDebugLogger.log("horizontal", "expanded ignored: value unchanged=\(expanded)")
      return
    }
    transitionGeneration += 1
    let generation = transitionGeneration
    pendingTransitionGeneration = generation
    dismissRequested = !expanded
    transitionCompleted = false
    lastLoggedPresentationMilestone = nil
    logPresentationProgress(expanded ? 0 : 1, reason: "presentation start targetExpanded=\(expanded)")

    if animated {
      withAnimation(SliderGeometry.presentationSpring) {
        isExpanded = expanded
      }
    } else {
      isExpanded = expanded
      completeTransitionIfPending(generation)
    }
  }

  func completeTransitionIfPending(_ generation: Int) {
    guard pendingTransitionGeneration == generation else {
      guard lastIgnoredCompletionGeneration != generation else { return }
      lastIgnoredCompletionGeneration = generation
      IntensityDebugLogger.log(
        "horizontal",
        "transition completion ignored stale generation=\(generation) pending=\(String(describing: pendingTransitionGeneration))"
      )
      return
    }
    pendingTransitionGeneration = nil
    transitionCompleted = isExpanded
    logPresentationProgress(isExpanded ? 1 : 0, reason: "transition end")
    IntensityDebugLogger.log(
      "horizontal",
      "transition end expanded=\(isExpanded) geometryReady=\(geometryReady) generation=\(generation)"
    )
    onTransitionComplete?(isExpanded)
  }

  func logPresentationProgress(_ progress: CGFloat, reason: String = "animation") {
    let milestone: Int
    if progress <= 0.01 {
      milestone = 0
    } else if progress >= 0.99 {
      milestone = 100
    } else if (0.45...0.55).contains(progress) {
      milestone = 50
    } else {
      return
    }
    guard lastLoggedPresentationMilestone != milestone else { return }
    lastLoggedPresentationMilestone = milestone
    IntensityDebugLogger.log(
      "horizontal",
      "presentationProgress milestone=\(milestone == 50 ? "~0.5" : String(format: "%.1f", Double(milestone) / 100)) value=\(String(format: "%.3f", Double(progress))) reason=\(reason) expanded=\(isExpanded) generation=\(transitionGeneration)"
    )
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
    onInteractionCommitted?(step)
  }

  func requestDismiss() {
    guard isExpanded, !dismissRequested else {
      IntensityDebugLogger.log(
        "horizontal",
        "dismiss request ignored expanded=\(isExpanded) dismissRequested=\(dismissRequested)"
      )
      return
    }
    IntensityDebugLogger.log("horizontal", "dismiss request accepted generation=\(transitionGeneration)")
    dismissRequested = true
    onDismissRequest?()
  }

  func setSelectedStep(_ step: ModelIntensityStep, notify: Bool = false) {
    guard selectedStep != step else { return }
    IntensityDebugLogger.log(
      "horizontal",
      "selectedStep changed from=\(selectedStep.rawValue) to=\(step.rawValue) notify=\(notify)"
    )
    selectedStep = step
    guard notify else { return }
    stepImpactFeedback.impactOccurred()
    stepImpactFeedback.prepare()
    onStepChange?(step)
  }

  func moveSelection(by delta: Int) {
    setSelectedStep(.from(index: selectedStep.index + delta), notify: true)
  }

  func prepareStepImpactFeedback() {
    stepImpactFeedback.prepare()
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
          let finalShellFrame = SliderGeometry.finalShellFrame(
            in: model.targetFrame,
            verticallyCenteredOn: sourceFrame
          )
          let visibleShellFrame = model.isExpanded ? finalShellFrame : sourceFrame
          let finalLabelCenter = SliderGeometry.labelCenter(above: finalShellFrame)
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
            onDragStart: model.prepareStepImpactFeedback,
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
        reduceMotion ? nil : SliderGeometry.presentationSpring,
        value: model.isExpanded
      )
      .onAppear {
        logSwiftUIState(reason: "content appear", canvasSize: geometry.size)
      }
      .onChange(of: model.geometryReady) { _ in
        logSwiftUIState(reason: "geometryReady changed", canvasSize: geometry.size)
      }
      .onChange(of: model.isExpanded) { _ in
        logSwiftUIState(reason: "expanded changed", canvasSize: geometry.size)
      }
      .onChange(of: model.selectedStep) { _ in
        logSwiftUIState(reason: "selectedStep changed", canvasSize: geometry.size)
      }
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
        onProgress: { model.logPresentationProgress($0) },
        onCompletion: { model.completeTransitionIfPending($0) }
      )
    )
  }

  private func logSwiftUIState(reason: String, canvasSize: CGSize) {
    let visibleShellFrame: CGRect
    let labelOpacity: CGFloat
    if model.geometryReady {
      visibleShellFrame = model.isExpanded
        ? SliderGeometry.finalShellFrame(
          in: model.targetFrame,
          verticallyCenteredOn: model.originFrame
        )
        : model.originFrame
      labelOpacity = model.isExpanded ? 1 : 0
    } else {
      visibleShellFrame = .zero
      labelOpacity = 0
    }

    IntensityDebugLogger.log(
      "horizontal",
      "SwiftUI content state reason=\(reason) canvasSize=\(canvasSize) contentMounted=\(model.geometryReady) geometryReady=\(model.geometryReady) expanded=\(model.isExpanded) selectedStep=\(model.selectedStep.rawValue) originFrame=\(model.originFrame) targetFrame=\(model.targetFrame) finalTrackFrame=\(visibleShellFrame) trackOpacity=\(model.geometryReady ? 1 : 0) labelOpacity=\(labelOpacity)"
    )
  }
}

private enum SliderGeometry {
  static let shellHeight: CGFloat = 66
  static let railHorizontalInset: CGFloat = 10
  static let railVerticalInset: CGFloat = 9
  static let thumbDiameter: CGFloat = 44
  static let draggingThumbHorizontalScale: CGFloat = 1.035
  static let markerDiameter: CGFloat = 6
  static let labelHeight: CGFloat = 21
  static let labelGap: CGFloat = 4
  static let maximumOuterOverscroll: CGFloat = 10
  static let maximumInnerOverscroll: CGFloat = 22
  static let thumbOuterContainmentInset: CGFloat = 2
  static var presentationSpring: Animation {
    .spring(response: 0.27, dampingFraction: 0.92)
  }

  static func finalShellFrame(in target: CGRect, verticallyCenteredOn origin: CGRect) -> CGRect {
    return CGRect(
      x: target.minX,
      y: origin.midY - shellHeight / 2,
      width: target.width,
      height: shellHeight
    )
  }

  static func labelCenter(above shell: CGRect) -> CGPoint {
    CGPoint(x: shell.midX, y: shell.minY - labelGap - labelHeight / 2)
  }

  static func thumbHorizontalScale(isDragging: Bool) -> CGFloat {
    isDragging ? draggingThumbHorizontalScale : 1
  }

  static func effectiveThumbRadius(isDragging: Bool) -> CGFloat {
    thumbDiameter * thumbHorizontalScale(isDragging: isDragging) / 2
  }

  static func containedThumbCenterX(
    _ candidate: CGFloat,
    outerRect: CGRect,
    effectiveThumbRadius: CGFloat
  ) -> CGFloat {
    let minimum = outerRect.minX + effectiveThumbRadius + thumbOuterContainmentInset
    let maximum = outerRect.maxX - effectiveThumbRadius - thumbOuterContainmentInset
    guard minimum <= maximum else { return outerRect.midX }
    return min(max(candidate, minimum), maximum)
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
      let shellHeight = min(SliderGeometry.shellHeight, height)
      let baseOuterRect = CGRect(
        x: 0,
        y: (height - shellHeight) / 2,
        width: width,
        height: shellHeight
      )
      let baseInnerRect = baseOuterRect.insetBy(
        dx: SliderGeometry.railHorizontalInset,
        dy: SliderGeometry.railVerticalInset
      )
      let rawForVisuals = isGestureActive ? rawDragProgress : logicalProgress
      let overscroll = overscrollDistance(
        rawForVisuals,
        available: max(baseInnerRect.width - SliderGeometry.thumbDiameter, 1)
      )
      let outerLeadingStretch = overscroll.direction < 0 ? overscroll.outer : 0
      let outerTrailingStretch = overscroll.direction > 0 ? overscroll.outer : 0
      let outerRect = CGRect(
        x: baseOuterRect.minX - outerLeadingStretch,
        y: baseOuterRect.minY,
        width: baseOuterRect.width + outerLeadingStretch + outerTrailingStretch,
        height: baseOuterRect.height
      )
      let requestedInnerLeadingStretch = overscroll.direction < 0 ? overscroll.inner : 0
      let requestedInnerTrailingStretch = overscroll.direction > 0 ? overscroll.inner : 0
      let thumbHorizontalScale = SliderGeometry.thumbHorizontalScale(isDragging: isDragging)
      let effectiveThumbRadius = SliderGeometry.effectiveThumbRadius(isDragging: isDragging)
      let thumbStretchClearance =
        effectiveThumbRadius - SliderGeometry.thumbDiameter / 2
        + SliderGeometry.thumbOuterContainmentInset
      let maximumInnerLeadingStretch = max(
        baseInnerRect.minX - outerRect.minX - thumbStretchClearance,
        0
      )
      let maximumInnerTrailingStretch = max(
        outerRect.maxX - baseInnerRect.maxX - thumbStretchClearance,
        0
      )
      let innerLeadingStretch = min(requestedInnerLeadingStretch, maximumInnerLeadingStretch)
      let innerTrailingStretch = min(requestedInnerTrailingStretch, maximumInnerTrailingStretch)
      let innerRect = CGRect(
        x: baseInnerRect.minX - innerLeadingStretch,
        y: baseInnerRect.minY,
        width: baseInnerRect.width + innerLeadingStretch + innerTrailingStretch,
        height: baseInnerRect.height
      )
      let candidateThumbCenterX = innerRect.minX + SliderGeometry.thumbDiameter / 2
        + logicalProgress * max(innerRect.width - SliderGeometry.thumbDiameter, 0)
      let thumbCenter = CGPoint(
        x: SliderGeometry.containedThumbCenterX(
          candidateThumbCenterX,
          outerRect: outerRect,
          effectiveThumbRadius: effectiveThumbRadius
        ),
        y: innerRect.midY
      )
      let fillWidth = clamp(
        thumbCenter.x + effectiveThumbRadius - innerRect.minX,
        to: 0...innerRect.width
      )

      ZStack(alignment: .topLeading) {
        trackShell(width: outerRect.width, height: outerRect.height)
          .offset(x: outerRect.minX, y: outerRect.minY)

        innerRail(
          rect: innerRect,
          progress: logicalProgress,
          fillWidth: fillWidth,
          thumbCenter: thumbCenter,
          thumbHorizontalScale: thumbHorizontalScale
        )
        .offset(x: innerRect.minX, y: innerRect.minY)
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

            let progress = rawProgress(for: event.location.x, railWidth: baseInnerRect.width)
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
              rawDragProgress = progress
            }
            onStepChange(.from(index: Int((clamp(progress, to: 0...1) * 2).rounded())))
          }
          .onEnded { event in
            let progress = clamp(rawProgress(for: event.location.x, railWidth: baseInnerRect.width), to: 0...1)
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
        onProgress: { _ in },
        onCompletion: completeSnapIfPending
      )
    )
    .accessibilityHidden(true)
  }

  private func innerRail(
    rect: CGRect,
    progress: CGFloat,
    fillWidth: CGFloat,
    thumbCenter: CGPoint,
    thumbHorizontalScale: CGFloat
  ) -> some View {
    let width = rect.width
    let height = rect.height
    let centerY = thumbCenter.y - rect.minY

    return ZStack(alignment: .topLeading) {
      Capsule()
        .fill(.ultraThinMaterial)
        .overlay {
          Capsule().fill(Color.black.opacity(colorScheme == "dark" ? 0.48 : 0.34))
        }
        .overlay {
          Capsule().strokeBorder(Color.white.opacity(colorScheme == "dark" ? 0.16 : 0.22), lineWidth: 0.7)
        }
        .frame(width: width, height: height)

      ZStack(alignment: .topLeading) {
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
            .fill(Color.white.opacity(CGFloat(step.index) / 2 <= progress ? 0.68 : 0.56))
            .frame(width: SliderGeometry.markerDiameter, height: SliderGeometry.markerDiameter)
            .position(
              x: SliderGeometry.thumbDiameter / 2
                + CGFloat(step.index) / 2 * max(width - SliderGeometry.thumbDiameter, 0),
              y: centerY
            )
            .accessibilityHidden(true)
        }
      }
      .frame(width: width, height: height)
      .clipShape(Capsule())

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
        .scaleEffect(
          x: thumbHorizontalScale,
          y: isDragging ? 0.985 : 1
        )
        .position(x: thumbCenter.x - rect.minX, y: centerY)
        .accessibilityHidden(true)
    }
    .frame(width: width, height: height)
  }

  @ViewBuilder
  private func trackShell(width: CGFloat, height: CGFloat) -> some View {
    if #available(iOS 26.0, *) {
      Capsule()
        .fill(Color.clear)
        .frame(width: width, height: height)
        .glassEffect(.clear.interactive(), in: Capsule())
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
  let onProgress: (CGFloat) -> Void
  let onCompletion: (Int) -> Void

  var animatableData: CGFloat {
    get { value }
    set {
      value = newValue
      onProgress(newValue)
      guard abs(newValue - target) < 0.001 else { return }
      let generation = generation
      let onCompletion = onCompletion
      DispatchQueue.main.async { onCompletion(generation) }
    }
  }

  init(
    value: CGFloat,
    generation: Int,
    onProgress: @escaping (CGFloat) -> Void,
    onCompletion: @escaping (Int) -> Void
  ) {
    self.value = value
    self.target = value
    self.generation = generation
    self.onProgress = onProgress
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
  private var lastMeasurementContextKey: String?
  private var lastLoggedSuccessRevision: Int?
  private var loggedGeometryDiagnosticKeys = Set<String>()
  private var loggedCoordinateConversionKeys = Set<String>()

  public let onStepChange = EventDispatcher()
  public let onTransitionComplete = EventDispatcher()
  public let onInteractionCommitted = EventDispatcher()
  public let onDismissRequest = EventDispatcher()
  public let onGeometryReady = EventDispatcher()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    IntensityDebugLogger.log(
      "horizontal",
      "ExpoView created id=\(ObjectIdentifier(self)) bounds=\(bounds) frame=\(frame) window={\(IntensityDebugLogger.describeWindow(window))} geometryReady=\(model.geometryReady)"
    )

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
    IntensityDebugLogger.log(
      "horizontal",
      "UIHostingController created hostView={\(IntensityDebugLogger.describeView(controller.view))}"
    )
  }

  deinit {
    IntensityDebugLogger.log("horizontal", "ExpoView deinit id=\(ObjectIdentifier(self))")
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    IntensityDebugLogger.log(
      "horizontal",
      "window attachment changed expoView={\(IntensityDebugLogger.describeView(self))} hostView={\(IntensityDebugLogger.describeView(hostingController?.view))}"
    )
    refreshMeasuredFrames(trigger: window == nil ? "detached" : "attached")
    applyPendingExpandedValueIfPossible()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    refreshMeasuredFrames(trigger: "layoutSubviews")
    applyPendingExpandedValueIfPossible()
  }

  public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let finalShellFrame = SliderGeometry.finalShellFrame(
      in: model.targetFrame,
      verticallyCenteredOn: model.originFrame
    )
    guard model.isInteractive, finalShellFrame.insetBy(dx: -2, dy: -2).contains(point) else {
      return nil
    }
    return super.hitTest(point, with: event)
  }

  func setExpanded(_ expanded: Bool) {
    IntensityDebugLogger.log(
      "horizontal",
      "expanded prop received value=\(expanded) current=\(model.isExpanded) pending=\(String(describing: pendingExpandedValue)) geometryReady=\(model.geometryReady) expoBounds=\(bounds) window={\(IntensityDebugLogger.describeWindow(window))}"
    )
    if expanded {
      guard !model.isExpanded else {
        IntensityDebugLogger.log("horizontal", "expanded prop ignored: already expanded")
        return
      }
      pendingExpandedValue = true
      refreshMeasuredFrames(trigger: "expanded true")
      applyPendingExpandedValueIfPossible()
      return
    }

    if pendingExpandedValue == true && !model.isExpanded {
      IntensityDebugLogger.log("horizontal", "pending open cancelled before presentation")
      pendingExpandedValue = nil
      onTransitionComplete(["expanded": false])
      return
    }

    guard model.isExpanded else {
      IntensityDebugLogger.log("horizontal", "expanded false ignored: model already collapsed")
      return
    }
    pendingExpandedValue = false
    applyPendingExpandedValueIfPossible()
  }

  func setOriginViewTag(_ tag: Int) {
    originViewTag = tag > 0 ? tag : nil
    IntensityDebugLogger.log("horizontal", "origin viewTag received raw=\(tag) stored=\(String(describing: originViewTag))")
    refreshMeasuredFrames(trigger: "originViewTag")
    applyPendingExpandedValueIfPossible()
  }

  func setTargetViewTag(_ tag: Int) {
    targetViewTag = tag > 0 ? tag : nil
    IntensityDebugLogger.log("horizontal", "target viewTag received raw=\(tag) stored=\(String(describing: targetViewTag))")
    refreshMeasuredFrames(trigger: "targetViewTag")
    applyPendingExpandedValueIfPossible()
  }

  func setGeometryRevision(_ revision: Int) {
    guard geometryRevision != revision else {
      IntensityDebugLogger.log("horizontal", "geometryRevision duplicate ignored=\(revision)")
      return
    }
    geometryRevision = revision
    IntensityDebugLogger.log("horizontal", "geometryRevision received=\(revision)")
    refreshMeasuredFrames(trigger: "geometryRevision")
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
    guard let expanded = pendingExpandedValue else { return }
    guard window != nil else {
      logGeometryDiagnosticOnce(
        key: "pending-window-nil-\(expanded)-\(geometryRevision)",
        message: "pending expanded=\(expanded) waiting: ExpoView has no UIWindow"
      )
      return
    }
    guard !expanded || model.geometryReady else {
      logGeometryDiagnosticOnce(
        key: "pending-geometry-\(expanded)-\(geometryRevision)-\(originViewTag ?? 0)-\(targetViewTag ?? 0)",
        message: "pending expanded=true waiting for geometryReady; originTag=\(String(describing: originViewTag)) targetTag=\(String(describing: targetViewTag)) window={\(IntensityDebugLogger.describeWindow(window))}"
      )
      return
    }
    pendingExpandedValue = nil

    if !expanded && !model.isExpanded {
      onTransitionComplete(["expanded": false])
      return
    }

    model.setExpanded(expanded, animated: !UIAccessibility.isReduceMotionEnabled)
  }

  private func refreshMeasuredFrames(trigger: String) {
    let windowIdentity = window.map { String(describing: ObjectIdentifier($0)) } ?? "nil"
    let originTagValue = originViewTag.map { String($0) } ?? "nil"
    let targetTagValue = targetViewTag.map { String($0) } ?? "nil"
    let contextKey = "\(geometryRevision)|\(bounds.size)|\(windowIdentity)|\(originTagValue)|\(targetTagValue)"
    if lastMeasurementContextKey != contextKey {
      lastMeasurementContextKey = contextKey
      IntensityDebugLogger.log(
        "horizontal",
        "measurement start trigger=\(trigger) revision=\(geometryRevision) expoBounds=\(bounds) expoFrame=\(frame) safeArea=\(safeAreaInsets) window={\(IntensityDebugLogger.describeWindow(window))} hostView={\(IntensityDebugLogger.describeView(hostingController?.view))} sourceTag=\(originTagValue) targetTag=\(targetTagValue) geometryReady=\(model.geometryReady) expanded=\(model.isExpanded)"
      )
    }

    guard bounds.width > 0 else {
      logGeometryDiagnosticOnce(
        key: "zero-width|\(geometryRevision)|\(windowIdentity)",
        message: "measurement guard failed: ExpoView bounds.width <= 0 bounds=\(bounds) window={\(IntensityDebugLogger.describeWindow(window))}"
      )
      return
    }
    guard bounds.height > 0 else {
      logGeometryDiagnosticOnce(
        key: "zero-height|\(geometryRevision)|\(windowIdentity)",
        message: "measurement guard failed: ExpoView bounds.height <= 0 bounds=\(bounds) window={\(IntensityDebugLogger.describeWindow(window))}"
      )
      return
    }
    guard let hostWindow = window else {
      logGeometryDiagnosticOnce(
        key: "host-window-nil|\(geometryRevision)|\(bounds.size)",
        message: "measurement guard failed: destination host UIWindow is nil expoView={\(IntensityDebugLogger.describeView(self))} hostView={\(IntensityDebugLogger.describeView(hostingController?.view))}"
      )
      return
    }
    guard let originViewTag else {
      logGeometryDiagnosticOnce(
        key: "origin-tag-nil|\(geometryRevision)|\(windowIdentity)",
        message: "measurement guard failed: source viewTag is nil destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }
    guard let targetViewTag else {
      logGeometryDiagnosticOnce(
        key: "target-tag-nil|\(geometryRevision)|\(windowIdentity)",
        message: "measurement guard failed: target viewTag is nil sourceTag=\(originViewTag) destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }
    guard let appContext else {
      logGeometryDiagnosticOnce(
        key: "app-context-nil|\(geometryRevision)|\(originViewTag)|\(targetViewTag)",
        message: "measurement guard failed: Expo appContext is nil sourceTag=\(originViewTag) targetTag=\(targetViewTag)"
      )
      return
    }
    guard let originView = appContext.findView(withTag: originViewTag, ofType: UIView.self) else {
      logGeometryDiagnosticOnce(
        key: "source-view-unresolved|\(geometryRevision)|\(originViewTag)|\(targetViewTag)",
        message: "measurement guard failed: source viewTag unresolved sourceTag=\(originViewTag) targetTag=\(targetViewTag) appContext=available destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }
    guard let targetView = appContext.findView(withTag: targetViewTag, ofType: UIView.self) else {
      logGeometryDiagnosticOnce(
        key: "target-view-unresolved|\(geometryRevision)|\(originViewTag)|\(targetViewTag)",
        message: "measurement guard failed: target viewTag unresolved targetTag=\(targetViewTag) source={\(IntensityDebugLogger.describeView(originView))} destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }

    guard let originFrame = frame(of: originView, in: hostWindow, role: "source") else {
      logGeometryDiagnosticOnce(
        key: "source-conversion-failed|\(geometryRevision)|\(originViewTag)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: source coordinate conversion returned nil source={\(IntensityDebugLogger.describeView(originView))} destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }
    guard let targetFrame = frame(of: targetView, in: hostWindow, role: "target") else {
      logGeometryDiagnosticOnce(
        key: "target-conversion-failed|\(geometryRevision)|\(originViewTag)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: target coordinate conversion returned nil target={\(IntensityDebugLogger.describeView(targetView))} destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }

    let geometryIsFinite = IntensityDebugLogger.isFinite(originFrame)
      && IntensityDebugLogger.isFinite(targetFrame)
    if !geometryIsFinite {
      logGeometryDiagnosticOnce(
        key: "nonfinite-geometry|\(geometryRevision)|\(originViewTag)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement result is non-finite originFrame=\(originFrame) targetFrame=\(targetFrame) source={\(IntensityDebugLogger.describeView(originView))} target={\(IntensityDebugLogger.describeView(targetView))} hostBounds=\(bounds)"
      )
    }
    guard originFrame.width > 0 else {
      logGeometryDiagnosticOnce(
        key: "source-width-invalid|\(geometryRevision)|\(originViewTag)|\(windowIdentity)",
        message: "measurement guard failed: converted source width <= 0 frame=\(originFrame) source={\(IntensityDebugLogger.describeView(originView))}"
      )
      return
    }
    guard originFrame.height > 0 else {
      logGeometryDiagnosticOnce(
        key: "source-height-invalid|\(geometryRevision)|\(originViewTag)|\(windowIdentity)",
        message: "measurement guard failed: converted source height <= 0 frame=\(originFrame) source={\(IntensityDebugLogger.describeView(originView))}"
      )
      return
    }
    guard targetFrame.width > 0 else {
      logGeometryDiagnosticOnce(
        key: "target-width-invalid|\(geometryRevision)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: converted target width <= 0 frame=\(targetFrame) target={\(IntensityDebugLogger.describeView(targetView))}"
      )
      return
    }
    guard targetFrame.height > 0 else {
      logGeometryDiagnosticOnce(
        key: "target-height-invalid|\(geometryRevision)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: converted target height <= 0 frame=\(targetFrame) target={\(IntensityDebugLogger.describeView(targetView))}"
      )
      return
    }

    guard !isNearlyEqual(model.originFrame, originFrame) || !isNearlyEqual(model.targetFrame, targetFrame) else {
      logGeometryDiagnosticOnce(
        key: "unchanged-geometry|\(geometryRevision)|\(originViewTag)|\(targetViewTag)",
        message: "measurement skipped: converted geometry unchanged within 0.25pt origin=\(originFrame) target=\(targetFrame) geometryReady=\(model.geometryReady)"
      )
      return
    }

    let wasReady = model.geometryReady
    if !wasReady || lastLoggedSuccessRevision != geometryRevision {
      IntensityDebugLogger.log(
        "horizontal",
        "measurement success sourceTag=\(originViewTag) source={\(IntensityDebugLogger.describeView(originView))} targetTag=\(targetViewTag) target={\(IntensityDebugLogger.describeView(targetView))} hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} hostBounds=\(bounds) originFrameLocal=\(originFrame) targetFrameLocal=\(targetFrame) finite=\(geometryIsFinite) originVisibleInHost=\(originFrame.intersects(bounds)) targetVisibleInHost=\(targetFrame.intersects(bounds))"
      )
      lastLoggedSuccessRevision = geometryRevision
    }
    loggedGeometryDiagnosticKeys.removeAll()
    model.updateGeometry(origin: originFrame, target: targetFrame)
    if !wasReady {
      IntensityDebugLogger.log(
        "horizontal",
        "geometryReady false -> true originFrame=\(originFrame) targetFrame=\(targetFrame)"
      )
      onGeometryReady(["ready": true])
      IntensityDebugLogger.log("horizontal", "onGeometryReady(true) dispatched")
    }
  }

  private func frame(of view: UIView, in hostWindow: UIWindow, role: String) -> CGRect? {
    guard let sourceWindow = view.window else {
      logGeometryDiagnosticOnce(
        key: "\(role)-source-window-nil|\(geometryRevision)|\(view.tag)|\(ObjectIdentifier(hostWindow))",
        message: "coordinate conversion failed: \(role) source view has no UIWindow view={\(IntensityDebugLogger.describeView(view))} hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return nil
    }
    let sourceScreen = sourceWindow.screen
    let hostScreen = hostWindow.screen
    let screenGeometryFailure = IntensityCoordinateConverter.incompatibilityReason(
      sourceScreen: sourceScreen,
      destinationScreen: hostScreen
    )
    guard screenGeometryFailure == nil else {
      logGeometryDiagnosticOnce(
        key: "\(role)-screen-mismatch|\(geometryRevision)|\(view.tag)|\(ObjectIdentifier(sourceWindow))|\(ObjectIdentifier(hostWindow))",
        message: "coordinate conversion failed: \(role) source and host display geometries are incompatible reason=\(screenGeometryFailure ?? "unknown") sourceScreen={\(IntensityScreenGeometry(screen: sourceScreen).diagnosticDescription)} hostScreen={\(IntensityScreenGeometry(screen: hostScreen).diagnosticDescription)} sourceWindow={\(IntensityDebugLogger.describeWindow(sourceWindow))} hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} sameScene=\(IntensityDebugLogger.sameWindowScene(sourceWindow, hostWindow))"
      )
      return nil
    }

    let rectInSourceWindow = view.convert(view.bounds, to: sourceWindow)
    guard let conversion = IntensityCoordinateConverter.convertRect(
      rectInSourceWindow,
      from: sourceWindow,
      to: hostWindow
    ) else {
      logGeometryDiagnosticOnce(
        key: "\(role)-screen-conversion-failed|\(geometryRevision)|\(view.tag)|\(ObjectIdentifier(sourceWindow))|\(ObjectIdentifier(hostWindow))",
        message: "coordinate conversion failed after display compatibility check role=\(role) sourceWindow={\(IntensityDebugLogger.describeWindow(sourceWindow))} hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} sourceWindowRect=\(rectInSourceWindow)"
      )
      return nil
    }
    let rectOnScreen = conversion.sourceScreenRect
    let rectInHostWindow = conversion.destinationWindowRect
    let localFrame = convert(rectInHostWindow, from: hostWindow)
    let conversionKey = "\(role)|\(geometryRevision)|\(ObjectIdentifier(view))|\(ObjectIdentifier(sourceWindow))|\(ObjectIdentifier(hostWindow))"
    if loggedCoordinateConversionKeys.insert(conversionKey).inserted {
      IntensityDebugLogger.log(
        "horizontal",
        "coordinate conversion role=\(role) view={\(IntensityDebugLogger.describeView(view))} sourceWindow={\(IntensityDebugLogger.describeWindow(sourceWindow))} destinationWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} sameScene=\(IntensityDebugLogger.sameWindowScene(sourceWindow, hostWindow)) screenInstancesIdentical=\(sourceScreen === hostScreen) geometryCompatible=true sourceScreenGeometry={\(IntensityScreenGeometry(screen: sourceScreen).diagnosticDescription)} destinationScreenGeometry={\(IntensityScreenGeometry(screen: hostScreen).diagnosticDescription)} sourceBounds=\(view.bounds) sourceWindowFrame=\(rectInSourceWindow) screenFrame=\(rectOnScreen) hostWindowFrame=\(rectInHostWindow) expoViewFrame=\(localFrame) finite=\(IntensityDebugLogger.isFinite(localFrame)) visibleOnScreen=\(rectOnScreen.intersects(sourceScreen.bounds)) visibleInHost=\(rectInHostWindow.intersects(hostWindow.bounds))"
      )
    }
    return localFrame
  }

  private func logGeometryDiagnosticOnce(key: String, message: String) {
    guard loggedGeometryDiagnosticKeys.insert(key).inserted else { return }
    IntensityDebugLogger.log("horizontal", message)
  }

  private func isNearlyEqual(_ lhs: CGRect, _ rhs: CGRect) -> Bool {
    let tolerance: CGFloat = 0.25
    return abs(lhs.minX - rhs.minX) < tolerance
      && abs(lhs.minY - rhs.minY) < tolerance
      && abs(lhs.width - rhs.width) < tolerance
      && abs(lhs.height - rhs.height) < tolerance
  }
}
