import ExpoModulesCore
import SwiftUI
import UIKit

private final class NativeSendIntelligencePickerModel: ObservableObject {
  @Published var isExpanded = false
  @Published var selectedStep: ModelIntensityStep = .medium
  @Published var colorScheme = "light"
  @Published var accentColorHex = "#0A84FF"
  @Published var sendSurfaceColorHex = "#000000"
  @Published var sendContentColorHex = "#FFFFFF"
  @Published private(set) var originFrame = CGRect.zero
  @Published private(set) var targetFrame = CGRect.zero
  @Published private(set) var geometryReady = false
  @Published private(set) var transitionCompleted = false
  @Published private(set) var transitionGeneration = 0
  @Published private(set) var rawDragProgress: CGFloat = 0.5
  @Published private(set) var isDragging = false
  @Published private(set) var isSnapping = false
  @Published private(set) var snapAnimationValue: CGFloat = 0
  @Published private(set) var snapGeneration = 0

  var onStepChange: ((ModelIntensityStep) -> Void)?
  var onTransitionComplete: ((Bool) -> Void)?
  var onInteractionCommitted: ((ModelIntensityStep) -> Void)?
  var onDismissRequest: (() -> Void)?

  private var pendingTransitionGeneration: Int?
  private var pendingCommitStep: ModelIntensityStep?
  private var pendingCommitGeneration: Int?
  private var dismissRequested = false
  private var lastLoggedPresentationMilestone: Int?
  private var lastIgnoredCompletionGeneration: Int?
  private let stepImpactFeedback = UIImpactFeedbackGenerator(style: .light)

  func setExpanded(_ expanded: Bool, animated: Bool) {
    IntensityDebugLogger.log(
      "vertical",
      "model expanded received value=\(expanded) current=\(isExpanded) geometryReady=\(geometryReady) transitionCompleted=\(transitionCompleted) animated=\(animated)"
    )
    guard isExpanded != expanded else {
      IntensityDebugLogger.log("vertical", "expanded ignored: value unchanged=\(expanded)")
      return
    }
    transitionGeneration += 1
    let generation = transitionGeneration
    pendingTransitionGeneration = generation
    dismissRequested = !expanded
    transitionCompleted = false
    lastLoggedPresentationMilestone = nil
    reportPresentationMilestone(expanded ? 0 : 1, reason: "presentation start targetExpanded=\(expanded)")

    if animated {
      withAnimation(SendIntensityPickerGeometry.presentationSpring) {
        isExpanded = expanded
      }
    } else {
      isExpanded = expanded
    }
  }

  func completeTransitionIfPending(_ generation: Int) {
    guard pendingTransitionGeneration == generation else {
      guard lastIgnoredCompletionGeneration != generation else { return }
      lastIgnoredCompletionGeneration = generation
      IntensityDebugLogger.log(
        "vertical",
        "transition completion ignored stale generation=\(generation) pending=\(String(describing: pendingTransitionGeneration))"
      )
      return
    }
    pendingTransitionGeneration = nil
    transitionCompleted = isExpanded
    reportPresentationMilestone(isExpanded ? 1 : 0, reason: "transition end")
    IntensityDebugLogger.log(
      "vertical",
      "transition end expanded=\(isExpanded) geometryReady=\(geometryReady) generation=\(generation)"
    )
    onTransitionComplete?(isExpanded)
  }

  @discardableResult
  func reportPresentationMilestone(_ progress: CGFloat, reason: String = "animation") -> Bool {
    let milestone: Int
    if progress <= 0.01 {
      milestone = 0
    } else if progress >= 0.99 {
      milestone = 100
    } else if (0.45...0.55).contains(progress) {
      milestone = 50
    } else {
      return false
    }
    guard lastLoggedPresentationMilestone != milestone else { return false }
    lastLoggedPresentationMilestone = milestone
    IntensityDebugLogger.log(
      "vertical",
      "presentationProgress milestone=\(milestone == 50 ? "~0.5" : String(format: "%.1f", Double(milestone) / 100)) value=\(String(format: "%.3f", Double(progress))) reason=\(reason) expanded=\(isExpanded) generation=\(transitionGeneration)"
    )
    return true
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

  var isTrackingInteraction: Bool {
    isDragging || isSnapping
  }

  var currentProgress: CGFloat {
    isTrackingInteraction ? clamp(rawDragProgress, to: 0...1) : CGFloat(selectedStep.index) / 2
  }

  func beginInteraction(at progress: CGFloat? = nil) {
    IntensityDebugLogger.log(
      "vertical",
      "interaction began progress=\(progress.map { String(format: "%.3f", Double($0)) } ?? "current") selectedStep=\(selectedStep.rawValue) geometryReady=\(geometryReady)"
    )
    snapGeneration += 1
    pendingCommitStep = nil
    pendingCommitGeneration = nil
    isSnapping = false
    isDragging = true
    if let progress {
      rawDragProgress = progress
    } else {
      rawDragProgress = CGFloat(selectedStep.index) / 2
    }
    prepareStepImpactFeedback()
  }

  func updateInteraction(progress: CGFloat) {
    var transaction = Transaction()
    transaction.disablesAnimations = true
    withTransaction(transaction) {
      rawDragProgress = progress
    }
    let boundedProgress = clamp(progress, to: 0...1)
    setSelectedStep(.from(index: Int((boundedProgress * 2).rounded())), notify: true)
  }

  func endInteraction(progress: CGFloat, animated: Bool) {
    let boundedProgress = clamp(progress, to: 0...1)
    let step = ModelIntensityStep.from(index: Int((boundedProgress * 2).rounded()))
    setSelectedStep(step, notify: true)
    snapGeneration += 1
    let generation = snapGeneration
    pendingCommitStep = step
    pendingCommitGeneration = generation
    let target = CGFloat(step.index) / 2
    IntensityDebugLogger.log(
      "vertical",
      "interaction ended rawProgress=\(String(format: "%.3f", Double(progress))) boundedProgress=\(String(format: "%.3f", Double(boundedProgress))) snapTarget=\(String(format: "%.3f", Double(target))) step=\(step.rawValue) animated=\(animated)"
    )

    if animated {
      withAnimation(.spring(response: 0.34, dampingFraction: 0.93)) {
        rawDragProgress = target
        isDragging = false
        isSnapping = true
        snapAnimationValue = CGFloat(generation)
      }
    } else {
      var transaction = Transaction()
      transaction.disablesAnimations = true
      withTransaction(transaction) {
        rawDragProgress = target
        isDragging = false
        isSnapping = true
        snapAnimationValue = CGFloat(generation)
      }
      completeSnapIfPending(generation)
    }
  }

  func cancelInteraction() {
    IntensityDebugLogger.log(
      "vertical",
      "interaction cancelled selectedStep=\(selectedStep.rawValue) rawProgress=\(String(format: "%.3f", Double(rawDragProgress)))"
    )
    snapGeneration += 1
    pendingCommitStep = nil
    pendingCommitGeneration = nil
    isDragging = false
    isSnapping = false
    rawDragProgress = CGFloat(selectedStep.index) / 2
  }

  func completeSnapIfPending(_ generation: Int) {
    guard pendingCommitGeneration == generation, let step = pendingCommitStep else { return }
    pendingCommitGeneration = nil
    pendingCommitStep = nil
    isSnapping = false
    commitInteraction(step)
  }

  func requestDismiss() {
    guard isExpanded, !dismissRequested else {
      IntensityDebugLogger.log(
        "vertical",
        "dismiss request ignored expanded=\(isExpanded) dismissRequested=\(dismissRequested)"
      )
      return
    }
    IntensityDebugLogger.log("vertical", "dismiss request accepted generation=\(transitionGeneration)")
    dismissRequested = true
    onDismissRequest?()
  }

  func setSelectedStep(_ step: ModelIntensityStep, notify: Bool = false) {
    guard selectedStep != step else { return }
    IntensityDebugLogger.log(
      "vertical",
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

  private func clamp(_ value: CGFloat, to range: ClosedRange<CGFloat>) -> CGFloat {
    min(max(value, range.lowerBound), range.upperBound)
  }
}

private struct NativeSendIntelligencePickerContent: View {
  @ObservedObject var model: NativeSendIntelligencePickerModel
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var presentationProgress: CGFloat = 0

  var body: some View {
    GeometryReader { geometry in
      SendPickerPresentationProgress(
        progress: presentationProgress,
        onProgress: { animatedProgress in
          if model.reportPresentationMilestone(animatedProgress) {
            logSwiftUIState(
              reason: "presentation milestone",
              canvasSize: geometry.size,
              progress: animatedProgress
            )
          }
        }
      ) { animatedProgress in
        let progress = SendIntensityPickerGeometry.clamp(animatedProgress, to: 0...1)

        ZStack {
          if model.geometryReady {
            let sourceFrame = model.originFrame
            let canvasSize = geometry.size
            let finalIndicatorFrame = SendIntensityPickerGeometry.finalIndicatorFrame(
              alignedWith: sourceFrame
            )
            let visibleIndicatorFrame = SendIntensityPickerGeometry.presentationFrame(
              from: sourceFrame,
              to: finalIndicatorFrame,
              progress: progress
            )
            let finalTitleCenter = SendIntensityPickerGeometry.titleCenter(
              canvasSize: canvasSize
            )
            let titleReveal = SendIntensityPickerGeometry.reveal(progress, from: 0.38, to: 0.84)
            let labelReveal = SendIntensityPickerGeometry.reveal(progress, from: 0.42, to: 0.88)
            let closeReveal = SendIntensityPickerGeometry.reveal(progress, from: 0.48, to: 0.9)
            let sourceCenter = CGPoint(x: sourceFrame.midX, y: sourceFrame.midY)

            ZStack {
              Text("Intelligence")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.primary)
                .position(
                  CGPoint(
                    x: finalTitleCenter.x,
                    y: finalTitleCenter.y + 8 * (1 - titleReveal)
                  )
                )
                .opacity(titleReveal)

              ForEach(ModelIntensityStep.allCases, id: \.rawValue) { step in
                let finalLabelCenter = SendIntensityPickerGeometry.labelCenter(
                  for: step,
                  alignedWith: sourceFrame,
                  canvasSize: canvasSize
                )
                let markerAlignedLabelCenter = CGPoint(
                  x: finalLabelCenter.x,
                  y: SendIntensityPickerGeometry.markerCenterY(
                    for: step,
                    in: visibleIndicatorFrame
                  )
                )
                let labelStart = CGPoint(
                  x: markerAlignedLabelCenter.x - 15,
                  y: markerAlignedLabelCenter.y + 22
                )

                Text(step.pickerLabel)
                  .font(
                    .system(
                      size: step == model.selectedStep ? 20 : 18,
                      weight: step == model.selectedStep ? .semibold : .regular
                    )
                  )
                  .foregroundStyle(
                    step == model.selectedStep ? Color.primary : Color.secondary.opacity(0.78)
                  )
                  .frame(width: SendIntensityPickerGeometry.labelColumnWidth, alignment: .trailing)
                  .position(
                    SendIntensityPickerGeometry.interpolate(
                      from: labelStart,
                      to: markerAlignedLabelCenter,
                      progress: labelReveal
                    )
                  )
                  .opacity(labelReveal)
                  .animation(
                    reduceMotion ? nil : .easeInOut(duration: 0.12),
                    value: model.selectedStep
                  )
              }

              NativeSendIntelligencePickerTrack(
                model: model,
                presentationProgress: progress,
                reduceMotion: reduceMotion
              )
              .frame(width: visibleIndicatorFrame.width, height: visibleIndicatorFrame.height)
              .position(x: visibleIndicatorFrame.midX, y: visibleIndicatorFrame.midY)
              .allowsHitTesting(model.isInteractive)

              NativeSendIntelligencePickerAnchor(
                model: model,
                sourceFrame: sourceFrame,
                center: sourceCenter,
                closeReveal: closeReveal
              )
              .allowsHitTesting(model.isInteractive)
            }
          }
        }
        .frame(width: geometry.size.width, height: geometry.size.height)
        .onAppear {
          logSwiftUIState(reason: "content appear", canvasSize: geometry.size, progress: progress)
        }
        .onChange(of: model.geometryReady) { _ in
          logSwiftUIState(reason: "geometryReady changed", canvasSize: geometry.size, progress: progress)
        }
        .onChange(of: model.isExpanded) { _ in
          logSwiftUIState(reason: "expanded changed", canvasSize: geometry.size, progress: progress)
        }
        .onChange(of: model.selectedStep) { _ in
          logSwiftUIState(reason: "selectedStep changed", canvasSize: geometry.size, progress: progress)
        }
      }
    }
    .ignoresSafeArea()
    .contentShape(Rectangle())
    .preferredColorScheme(model.colorScheme == "dark" ? .dark : .light)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Intensidade do modelo")
    .accessibilityValue(model.selectedStep.pickerLabel)
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
      SendPickerAnimationCompletionObserver(
        value: presentationProgress,
        generation: model.transitionGeneration,
        onCompletion: { model.completeTransitionIfPending($0) }
      )
    )
    .onAppear {
      if model.transitionCompleted {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
          presentationProgress = model.isExpanded ? 1 : 0
        }
      } else if model.isExpanded {
        animatePresentation(to: 1)
      } else if presentationProgress > 0 {
        animatePresentation(to: 0)
      }
    }
    .onChange(of: model.isExpanded) { expanded in
      IntensityDebugLogger.log(
        "vertical",
        "SwiftUI presentation state changed expanded=\(expanded) progress=\(String(format: "%.3f", Double(presentationProgress))) reduceMotion=\(reduceMotion) geometryReady=\(model.geometryReady)"
      )
      animatePresentation(to: expanded ? 1 : 0)
    }
    .onDisappear {
      IntensityDebugLogger.log(
        "vertical",
        "SwiftUI content disappeared expanded=\(model.isExpanded) geometryReady=\(model.geometryReady) progress=\(String(format: "%.3f", Double(presentationProgress)))"
      )
    }
  }

  private func logSwiftUIState(reason: String, canvasSize: CGSize, progress: CGFloat) {
    guard model.geometryReady else {
      IntensityDebugLogger.log(
        "vertical",
        "SwiftUI content state reason=\(reason) canvasSize=\(canvasSize) contentMounted=false geometryReady=false expanded=\(model.isExpanded) selectedStep=\(model.selectedStep.rawValue) progress=\(String(format: "%.3f", Double(progress))) frame=CGRect.zero opacity=0"
      )
      return
    }

    let finalIndicatorFrame = SendIntensityPickerGeometry.finalIndicatorFrame(
      alignedWith: model.originFrame
    )
    let boundedProgress = SendIntensityPickerGeometry.clamp(progress, to: 0...1)
    let visibleIndicatorFrame = SendIntensityPickerGeometry.presentationFrame(
      from: model.originFrame,
      to: finalIndicatorFrame,
      progress: boundedProgress
    )
    let titleOpacity = SendIntensityPickerGeometry.reveal(boundedProgress, from: 0.38, to: 0.84)
    let labelOpacity = SendIntensityPickerGeometry.reveal(boundedProgress, from: 0.42, to: 0.88)
    let closeOpacity = SendIntensityPickerGeometry.reveal(boundedProgress, from: 0.48, to: 0.9)
    let labelCenters = ModelIntensityStep.allCases.map { step in
      "\(step.rawValue):\(SendIntensityPickerGeometry.labelCenter(for: step, alignedWith: model.originFrame, canvasSize: canvasSize))"
    }.joined(separator: ";")

    IntensityDebugLogger.log(
      "vertical",
      "SwiftUI content state reason=\(reason) canvasSize=\(canvasSize) contentMounted=true geometryReady=true expanded=\(model.isExpanded) selectedStep=\(model.selectedStep.rawValue) progress=\(String(format: "%.3f", Double(progress))) originFrame=\(model.originFrame) targetFrame=\(model.targetFrame) finalIndicatorFrame=\(finalIndicatorFrame) renderedIndicatorFrame=\(visibleIndicatorFrame) trackOpacity=1 titleOpacity=\(titleOpacity) labelOpacity=\(labelOpacity) closeOpacity=\(closeOpacity) labelCenters={\(labelCenters)}"
    )
  }

  private func animatePresentation(to progress: CGFloat) {
    guard !reduceMotion else {
      presentationProgress = progress
      model.completeTransitionIfPending(model.transitionGeneration)
      return
    }

    guard abs(presentationProgress - progress) > 0.001 else {
      model.completeTransitionIfPending(model.transitionGeneration)
      return
    }

    withAnimation(SendIntensityPickerGeometry.presentationSpring) {
      presentationProgress = progress
    }
  }
}

private struct SendPickerPresentationProgress<Content: View>: View, Animatable {
  var progress: CGFloat
  private let onProgress: (CGFloat) -> Void
  private let content: (CGFloat) -> Content

  var animatableData: CGFloat {
    get { progress }
    set {
      progress = newValue
      onProgress(newValue)
    }
  }

  init(
    progress: CGFloat,
    onProgress: @escaping (CGFloat) -> Void,
    @ViewBuilder content: @escaping (CGFloat) -> Content
  ) {
    self.progress = progress
    self.onProgress = onProgress
    self.content = content
  }

  var body: some View {
    content(progress)
  }
}

private enum SendIntensityPickerGeometry {
  static let widgetWidth: CGFloat = 276
  static let indicatorColumnWidth: CGFloat = 49
  static let indicatorRightInset: CGFloat = 34
  static let labelColumnWidth: CGFloat = 124
  static let labelToIndicatorGap: CGFloat = 46
  static let levelSpacing: CGFloat = 63
  static let verticalTravelInset: CGFloat = 9
  static let levelsCenterFraction: CGFloat = 0.48
  static let titleTopFraction: CGFloat = 0.11
  static let thumbDiameter: CGFloat = 32
  static let draggingThumbVerticalScale: CGFloat = 1.08
  static let draggingThumbHorizontalScale: CGFloat = 0.94
  static let markerDiameter: CGFloat = 10
  static let maximumThumbOverscroll: CGFloat = 10
  static let maximumCapsuleStretch: CGFloat = 12
  static let capsuleHorizontalCompression: CGFloat = 0.025
  static let thumbStretchFollow: CGFloat = 0.55
  static let closeButtonDiameter: CGFloat = 37
  static let closeVisualDiameter: CGFloat = 32
  static let capsuleToCloseGap: CGFloat = 20
  static let indicatorTrackHeight: CGFloat =
    thumbDiameter + levelSpacing * 2 + verticalTravelInset * 2
  static var presentationSpring: Animation {
    .spring(response: 0.35, dampingFraction: 0.94)
  }

  static func widgetFrame(in target: CGRect, origin: CGRect) -> CGRect {
    let indicatorOffset = widgetWidth - indicatorRightInset - indicatorColumnWidth / 2
    let minimumX = target.minX + 8
    let maximumX = max(target.maxX - widgetWidth - 8, minimumX)
    let x = min(max(origin.midX - indicatorOffset, minimumX), maximumX)
    return CGRect(x: x, y: target.minY, width: widgetWidth, height: target.height)
  }

  static func finalIndicatorFrame(alignedWith origin: CGRect) -> CGRect {
    let finalBottom = origin.midY - closeVisualDiameter / 2 - capsuleToCloseGap
    return CGRect(
      x: origin.midX - indicatorColumnWidth / 2,
      y: finalBottom - indicatorTrackHeight,
      width: indicatorColumnWidth,
      height: indicatorTrackHeight
    )
  }

  static func presentationFrame(
    from origin: CGRect,
    to final: CGRect,
    progress: CGFloat
  ) -> CGRect {
    let boundedProgress = clamp(progress, to: 0...1)
    let expansion = reveal(boundedProgress, from: 0, to: 0.92)
    let anchorProgress = reveal(boundedProgress, from: 0.68, to: 1)
    let width = interpolate(origin.width, final.width, progress: expansion)
    let height = interpolate(origin.height, final.height, progress: expansion)
    let bottom = interpolate(origin.maxY, final.maxY, progress: anchorProgress)

    return CGRect(
      x: origin.midX - width / 2,
      y: bottom - height,
      width: width,
      height: height
    )
  }

  static func titleCenter(canvasSize: CGSize) -> CGPoint {
    CGPoint(x: canvasSize.width / 2, y: canvasSize.height * titleTopFraction)
  }

  static func labelCenter(
    for step: ModelIntensityStep,
    alignedWith origin: CGRect,
    canvasSize: CGSize
  ) -> CGPoint {
    let levelsCenterY = canvasSize.height * levelsCenterFraction
    let verticalOffset = CGFloat(1 - step.index) * levelSpacing
    let x = origin.midX - labelToIndicatorGap - labelColumnWidth / 2
    return CGPoint(x: x, y: levelsCenterY + verticalOffset)
  }

  static func dismissCenter(alignedWith origin: CGRect) -> CGPoint {
    CGPoint(x: origin.midX, y: origin.midY)
  }

  static func rubberBandDistance(
    rawProgress: CGFloat,
    travel: CGFloat,
    maximumDistance: CGFloat
  ) -> CGFloat {
    let boundedProgress = clamp(rawProgress, to: 0...1)
    let rawDistance = abs(rawProgress - boundedProgress) * travel
    guard rawDistance > 0, maximumDistance > 0 else { return 0 }
    return maximumDistance * (1 - exp(-rawDistance / maximumDistance))
  }

  static func markerCenterY(
    for step: ModelIntensityStep,
    in indicatorFrame: CGRect
  ) -> CGFloat {
    let diameter = min(thumbDiameter, max(min(indicatorFrame.width, indicatorFrame.height), 1))
    let travelInset = verticalTravelInset
    let travel = max(indicatorFrame.height - diameter - travelInset * 2, 0)
    return indicatorFrame.maxY - diameter / 2 - travelInset - CGFloat(step.index) / 2 * travel
  }

  static func interpolate(from start: CGPoint, to end: CGPoint, progress: CGFloat) -> CGPoint {
    CGPoint(
      x: interpolate(start.x, end.x, progress: progress),
      y: interpolate(start.y, end.y, progress: progress)
    )
  }

  static func reveal(_ progress: CGFloat, from start: CGFloat, to end: CGFloat) -> CGFloat {
    let normalized = clamp((progress - start) / max(end - start, 0.001), to: 0...1)
    return normalized * normalized * (3 - 2 * normalized)
  }

  static func clamp(_ value: CGFloat, to range: ClosedRange<CGFloat>) -> CGFloat {
    min(max(value, range.lowerBound), range.upperBound)
  }

  private static func interpolate(_ start: CGFloat, _ end: CGFloat, progress: CGFloat) -> CGFloat {
    start + (end - start) * progress
  }

  static func availableVerticalTravel() -> CGFloat {
    levelSpacing * 2
  }

  static func containsInteractivePoint(
    _ point: CGPoint,
    alignedWith origin: CGRect
  ) -> Bool {
    let indicatorHitFrame = finalIndicatorFrame(alignedWith: origin)
      .insetBy(dx: -12, dy: -12)
    let closeCenter = dismissCenter(alignedWith: origin)
    let closeHitFrame = CGRect(
      x: closeCenter.x - closeButtonDiameter / 2 - 8,
      y: closeCenter.y - closeButtonDiameter / 2 - 8,
      width: closeButtonDiameter + 16,
      height: closeButtonDiameter + 16
    )
    return indicatorHitFrame.contains(point) || closeHitFrame.contains(point)
  }
}

private struct NativeSendIntelligencePickerAnchor: View {
  @ObservedObject var model: NativeSendIntelligencePickerModel
  let sourceFrame: CGRect
  let center: CGPoint
  let closeReveal: CGFloat

  var body: some View {
    let sourceDiameter = min(sourceFrame.width, sourceFrame.height)
    let visualDiameter = interpolate(
      sourceDiameter,
      SendIntensityPickerGeometry.closeVisualDiameter,
      progress: closeReveal
    )

    Button(action: model.requestDismiss) {
      ZStack {
        Circle()
          .fill(Color(sendPickerHex: model.sendSurfaceColorHex))
          .opacity(1 - closeReveal)

        Circle()
          .fill(.ultraThinMaterial)
          .opacity(closeReveal)

        Image(systemName: "arrow.up")
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(Color(sendPickerHex: model.sendContentColorHex))
          .opacity(1 - closeReveal)

        Image(systemName: "xmark")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(Color.primary)
          .opacity(closeReveal)
      }
      .frame(width: visualDiameter, height: visualDiameter)
      .frame(
        width: SendIntensityPickerGeometry.closeButtonDiameter,
        height: SendIntensityPickerGeometry.closeButtonDiameter
      )
      .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .frame(
      width: SendIntensityPickerGeometry.closeButtonDiameter,
      height: SendIntensityPickerGeometry.closeButtonDiameter
    )
    .position(center)
    .accessibilityLabel("Fechar seletor de intensidade")
  }

  private func interpolate(_ start: CGFloat, _ end: CGFloat, progress: CGFloat) -> CGFloat {
    start + (end - start) * progress
  }
}

private struct NativeSendIntelligencePickerTrack: View {
  @ObservedObject var model: NativeSendIntelligencePickerModel
  @Environment(\.colorScheme) private var colorScheme
  let presentationProgress: CGFloat
  let reduceMotion: Bool

  var body: some View {
    GeometryReader { geometry in
      let width = geometry.size.width
      let height = geometry.size.height
      let morphProgress = SendIntensityPickerGeometry.clamp(presentationProgress, to: 0...1)
      let capsuleReveal = SendIntensityPickerGeometry.reveal(morphProgress, from: 0.04, to: 0.52)
      let markerReveal = SendIntensityPickerGeometry.reveal(morphProgress, from: 0.28, to: 0.72)
      let thumbReveal = SendIntensityPickerGeometry.reveal(morphProgress, from: 0.46, to: 0.88)
      let thumbDiameter = min(
        SendIntensityPickerGeometry.thumbDiameter,
        max(min(width, height), 1)
      )
      let rawForVisuals = model.isTrackingInteraction ? model.rawDragProgress : model.currentProgress
      let logicalProgress = clamp(rawForVisuals, to: 0...1)
      let baseTravel = max(
        height - thumbDiameter - SendIntensityPickerGeometry.verticalTravelInset * 2,
        1
      )
      let overscrollAmount = rubberBandAmount(
        rawForVisuals,
        travel: baseTravel
      )
      let desiredThumbVerticalScale = model.isDragging
        ? SendIntensityPickerGeometry.draggingThumbVerticalScale + overscrollAmount * 0.05
        : model.isSnapping
          ? 1 + overscrollAmount
            * (SendIntensityPickerGeometry.draggingThumbVerticalScale - 1 + 0.05)
          : 1
      let thumbHorizontalScale = model.isDragging
        ? SendIntensityPickerGeometry.draggingThumbHorizontalScale - overscrollAmount * 0.025
        : model.isSnapping
          ? 1 - overscrollAmount
            * (1 - SendIntensityPickerGeometry.draggingThumbHorizontalScale + 0.025)
          : 1
      let thumbVerticalScale = min(desiredThumbVerticalScale, height / max(thumbDiameter, 1))
      let visualThumbDiameter = thumbDiameter * thumbVerticalScale
      let thumbInset = visualThumbDiameter / 2
      let verticalTravelInset = SendIntensityPickerGeometry.verticalTravelInset
      let thumbTravel = max(height - visualThumbDiameter - verticalTravelInset * 2, 0)
      let stretchDirection: CGFloat = rawForVisuals > 1 ? -1 : rawForVisuals < 0 ? 1 : 0
      let capsuleStretch = SendIntensityPickerGeometry.rubberBandDistance(
        rawProgress: rawForVisuals,
        travel: baseTravel,
        maximumDistance: SendIntensityPickerGeometry.maximumCapsuleStretch
      )
      let capsuleMinY = stretchDirection < 0 ? -capsuleStretch : 0
      let capsuleMaxY = stretchDirection > 0 ? height + capsuleStretch : height
      let capsuleHeight = capsuleMaxY - capsuleMinY
      let capsuleCenterY = (capsuleMinY + capsuleMaxY) / 2
      let capsuleWidth = width * (
        1 - SendIntensityPickerGeometry.capsuleHorizontalCompression
          * capsuleStretch / SendIntensityPickerGeometry.maximumCapsuleStretch
      )
      let baseThumbCenterY = height - thumbInset - verticalTravelInset - logicalProgress * thumbTravel
      let stretchedThumbCenterY = baseThumbCenterY
        + stretchDirection * capsuleStretch * SendIntensityPickerGeometry.thumbStretchFollow
      let minimumThumbCenterY = capsuleMinY + verticalTravelInset + thumbInset
      let maximumThumbCenterY = capsuleMaxY - verticalTravelInset - thumbInset
      let thumbCenterY = min(
        max(stretchedThumbCenterY, minimumThumbCenterY),
        maximumThumbCenterY
      )

      ZStack {
        Capsule()
          .fill(.thinMaterial)
          .overlay {
            Capsule()
              .fill(
                colorScheme == .dark
                  ? Color.black.opacity(0.12)
                  : Color.white.opacity(0.08)
              )
          }
          .frame(width: capsuleWidth, height: capsuleHeight)
          .position(x: width / 2, y: capsuleCenterY)
          .opacity(capsuleReveal)
          .allowsHitTesting(false)
          .accessibilityHidden(true)

        ForEach(ModelIntensityStep.allCases, id: \.rawValue) { step in
          Circle()
            .fill(Color.primary.opacity(0.82))
            .frame(
              width: SendIntensityPickerGeometry.markerDiameter,
              height: SendIntensityPickerGeometry.markerDiameter
            )
            .position(
              x: width / 2,
              y: height - thumbInset - verticalTravelInset
                - CGFloat(step.index) / 2 * thumbTravel
            )
            .opacity(markerReveal)
            .accessibilityHidden(true)
        }

        Circle()
          .fill(Color.white)
          .frame(width: thumbDiameter, height: thumbDiameter)
          .overlay {
            Image(systemName: "arrow.up")
              .font(.system(size: 15, weight: .semibold))
              .foregroundStyle(Color.black.opacity(0.9))
          }
          .scaleEffect(x: thumbHorizontalScale, y: thumbVerticalScale)
          .position(x: width / 2, y: thumbCenterY)
          .opacity(thumbReveal)
          .accessibilityHidden(true)

      }
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
          .onChanged { event in
            if !model.isDragging {
              let progress = rawProgress(
                for: event.location.y,
                trackHeight: height,
                thumbDiameter: thumbDiameter
              )
              model.beginInteraction(at: progress)
            }
            model.updateInteraction(
              progress: rawProgress(
                for: event.location.y,
                trackHeight: height,
                thumbDiameter: thumbDiameter
              )
            )
          }
          .onEnded { event in
            let progress = rawProgress(
              for: event.location.y,
              trackHeight: height,
              thumbDiameter: thumbDiameter
            )
            model.endInteraction(progress: progress, animated: !reduceMotion)
          }
      )
    }
    .modifier(
      SendPickerAnimationCompletionObserver(
        value: model.snapAnimationValue,
        generation: model.snapGeneration,
        onCompletion: model.completeSnapIfPending
      )
    )
    .accessibilityHidden(true)
  }

  private func rawProgress(for locationY: CGFloat, trackHeight: CGFloat, thumbDiameter: CGFloat) -> CGFloat {
    let verticalTravelInset = SendIntensityPickerGeometry.verticalTravelInset
    let available = max(trackHeight - thumbDiameter - verticalTravelInset * 2, 1)
    return 1 - (locationY - thumbDiameter / 2 - verticalTravelInset) / available
  }

  private func rubberBandAmount(_ raw: CGFloat, travel: CGFloat) -> CGFloat {
    let bounded = clamp(raw, to: 0...1)
    let overshoot = (raw - bounded) * travel
    guard abs(overshoot) > 0 else { return 0 }

    let resistedDistance = SendIntensityPickerGeometry.maximumThumbOverscroll
      * (1 - exp(-abs(overshoot) / SendIntensityPickerGeometry.maximumThumbOverscroll))
    return min(resistedDistance / SendIntensityPickerGeometry.maximumThumbOverscroll, 1)
  }

  private func clamp(_ value: CGFloat, to range: ClosedRange<CGFloat>) -> CGFloat {
    min(max(value, range.lowerBound), range.upperBound)
  }

}

private extension Color {
  init(sendPickerHex hex: String) {
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

private struct SendPickerAnimationCompletionObserver: ViewModifier, Animatable {
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

public final class NativeSendIntelligencePickerView: ExpoView {
  private let model = NativeSendIntelligencePickerModel()
  private var hostingController: UIHostingController<NativeSendIntelligencePickerContent>?
  private var pendingExpandedValue: Bool?
  private var originViewTag: Int?
  private var targetViewTag: Int?
  private var interactionSessionId: String?
  private var wasAttachedToWindow = false
  private var sendHoldStartPoint: CGPoint?
  private var sendHoldStartProgress: CGFloat = 0.5
  private var pendingSendHoldStart: NativeSendHoldSample?
  private var pendingSendHoldLatest: NativeSendHoldSample?
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
  public let onHostDetached = EventDispatcher()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    IntensityDebugLogger.log(
      "vertical",
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

    let controller = UIHostingController(rootView: NativeSendIntelligencePickerContent(model: model))
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
      "vertical",
      "UIHostingController created hostView={\(IntensityDebugLogger.describeView(controller.view))}"
    )
  }

  deinit {
    IntensityDebugLogger.log("vertical", "ExpoView deinit id=\(ObjectIdentifier(self))")
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      wasAttachedToWindow = true
    } else if wasAttachedToWindow {
      wasAttachedToWindow = false
      IntensityDebugLogger.log("vertical", "native picker host detached from its window")
      onHostDetached([:])
    }
    IntensityDebugLogger.log(
      "vertical",
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
    guard
      model.isInteractive,
      SendIntensityPickerGeometry.containsInteractivePoint(point, alignedWith: model.originFrame)
    else {
      return nil
    }
    return super.hitTest(point, with: event)
  }

  func setExpanded(_ expanded: Bool) {
    IntensityDebugLogger.log(
      "vertical",
      "expanded prop received value=\(expanded) current=\(model.isExpanded) pending=\(String(describing: pendingExpandedValue)) geometryReady=\(model.geometryReady) expoBounds=\(bounds) window={\(IntensityDebugLogger.describeWindow(window))}"
    )
    if expanded {
      guard !model.isExpanded else {
        IntensityDebugLogger.log("vertical", "expanded prop ignored: already expanded")
        return
      }
      pendingExpandedValue = true
      refreshMeasuredFrames(trigger: "expanded true")
      applyPendingExpandedValueIfPossible()
      return
    }

    if pendingExpandedValue == true && !model.isExpanded {
      IntensityDebugLogger.log("vertical", "pending open cancelled before presentation")
      pendingExpandedValue = nil
      onTransitionComplete(["expanded": false])
      return
    }

    guard model.isExpanded else {
      IntensityDebugLogger.log("vertical", "expanded false ignored: model already collapsed")
      return
    }
    pendingExpandedValue = false
    applyPendingExpandedValueIfPossible()
  }

  func setOriginViewTag(_ tag: Int) {
    originViewTag = tag > 0 ? tag : nil
    IntensityDebugLogger.log("vertical", "origin viewTag received raw=\(tag) stored=\(String(describing: originViewTag))")
    refreshMeasuredFrames(trigger: "originViewTag")
    applyPendingExpandedValueIfPossible()
  }

  func setTargetViewTag(_ tag: Int) {
    targetViewTag = tag > 0 ? tag : nil
    IntensityDebugLogger.log("vertical", "target viewTag received raw=\(tag) stored=\(String(describing: targetViewTag))")
    refreshMeasuredFrames(trigger: "targetViewTag")
    applyPendingExpandedValueIfPossible()
  }

  func setInteractionSessionId(_ sessionId: String?) {
    guard interactionSessionId != sessionId else {
      IntensityDebugLogger.log("vertical", "interactionSessionId unchanged=\(String(describing: sessionId))")
      return
    }
    IntensityDebugLogger.log(
      "vertical",
      "interactionSessionId changed from=\(String(describing: interactionSessionId)) to=\(String(describing: sessionId))"
    )
    if let interactionSessionId {
      NativeModelIntensitySendGestureCoordinator.shared.stopObserving(sessionId: interactionSessionId)
    }
    interactionSessionId = sessionId
    sendHoldStartPoint = nil
    pendingSendHoldStart = nil
    pendingSendHoldLatest = nil
    guard let sessionId else { return }

    NativeModelIntensitySendGestureCoordinator.shared.observe(sessionId: sessionId) { [weak self] sample in
      self?.receiveSendHoldSample(sample)
    }
  }

  func setGeometryRevision(_ revision: Int) {
    guard geometryRevision != revision else {
      IntensityDebugLogger.log("vertical", "geometryRevision duplicate ignored=\(revision)")
      return
    }
    geometryRevision = revision
    IntensityDebugLogger.log("vertical", "geometryRevision received=\(revision)")
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

  func setSendSurfaceColor(_ color: String) {
    model.sendSurfaceColorHex = color
  }

  func setSendContentColor(_ color: String) {
    model.sendContentColorHex = color
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
        message: "pending expanded=true waiting for geometryReady; originTag=\(String(describing: originViewTag)) targetTag=\(String(describing: targetViewTag)) sessionId=\(String(describing: interactionSessionId)) window={\(IntensityDebugLogger.describeWindow(window))}"
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
        "vertical",
        "measurement start trigger=\(trigger) revision=\(geometryRevision) expoBounds=\(bounds) expoFrame=\(frame) safeArea=\(safeAreaInsets) window={\(IntensityDebugLogger.describeWindow(window))} hostView={\(IntensityDebugLogger.describeView(hostingController?.view))} sourceTag=\(originTagValue) targetTag=\(targetTagValue) sessionId=\(String(describing: interactionSessionId)) geometryReady=\(model.geometryReady) expanded=\(model.isExpanded)"
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
    guard let anchorFrame = frame(of: targetView, in: hostWindow, role: "target") else {
      logGeometryDiagnosticOnce(
        key: "target-conversion-failed|\(geometryRevision)|\(originViewTag)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: target coordinate conversion returned nil target={\(IntensityDebugLogger.describeView(targetView))} destination={\(IntensityDebugLogger.describeWindow(hostWindow))}"
      )
      return
    }

    let targetFrame = SendIntensityPickerGeometry.widgetFrame(in: anchorFrame, origin: originFrame)
    let geometryIsFinite = IntensityDebugLogger.isFinite(originFrame)
      && IntensityDebugLogger.isFinite(anchorFrame)
      && IntensityDebugLogger.isFinite(targetFrame)
    if !geometryIsFinite {
      logGeometryDiagnosticOnce(
        key: "nonfinite-geometry|\(geometryRevision)|\(originViewTag)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement result is non-finite originFrame=\(originFrame) anchorFrame=\(anchorFrame) targetFrame=\(targetFrame) source={\(IntensityDebugLogger.describeView(originView))} anchor={\(IntensityDebugLogger.describeView(targetView))} hostBounds=\(bounds)"
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
    guard anchorFrame.width > 0 else {
      logGeometryDiagnosticOnce(
        key: "target-width-invalid|\(geometryRevision)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: converted target width <= 0 frame=\(anchorFrame) target={\(IntensityDebugLogger.describeView(targetView))}"
      )
      return
    }
    guard anchorFrame.height > 0 else {
      logGeometryDiagnosticOnce(
        key: "target-height-invalid|\(geometryRevision)|\(targetViewTag)|\(windowIdentity)",
        message: "measurement guard failed: converted target height <= 0 frame=\(anchorFrame) target={\(IntensityDebugLogger.describeView(targetView))}"
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
        "vertical",
        "measurement success sourceTag=\(originViewTag) source={\(IntensityDebugLogger.describeView(originView))} targetTag=\(targetViewTag) anchor={\(IntensityDebugLogger.describeView(targetView))} hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} hostBounds=\(bounds) originFrameLocal=\(originFrame) anchorFrameLocal=\(anchorFrame) finalPickerFrameLocal=\(targetFrame) finite=\(geometryIsFinite) originVisibleInHost=\(originFrame.intersects(bounds)) pickerVisibleInHost=\(targetFrame.intersects(bounds))"
      )
      lastLoggedSuccessRevision = geometryRevision
    }
    loggedGeometryDiagnosticKeys.removeAll()
    model.updateGeometry(origin: originFrame, target: targetFrame)
    if !wasReady {
      IntensityDebugLogger.log(
        "vertical",
        "geometryReady false -> true originFrame=\(originFrame) targetFrame=\(targetFrame)"
      )
      onGeometryReady(["ready": true])
      IntensityDebugLogger.log("vertical", "onGeometryReady(true) dispatched")
    }
    applyPendingExpandedValueIfPossible()
    applyPendingSendHoldSamplesIfReady()
  }

  private func receiveSendHoldSample(_ sample: NativeSendHoldSample) {
    if sample.phase != .changed {
      IntensityDebugLogger.log(
        "vertical",
        "hold sample received phase=\(String(describing: sample.phase)) sessionId=\(sample.sessionId) activeSessionId=\(String(describing: interactionSessionId)) locationOnScreen=\(sample.locationOnScreen) sourceScreen=\(ObjectIdentifier(sample.sourceScreen)) screenBounds=\(sample.sourceScreen.bounds) geometryReady=\(model.geometryReady)"
      )
    }
    guard sample.sessionId == interactionSessionId else {
      logGeometryDiagnosticOnce(
        key: "hold-session-mismatch-\(sample.sessionId)",
        message: "hold sample ignored: session mismatch incoming=\(sample.sessionId) active=\(String(describing: interactionSessionId)) phase=\(String(describing: sample.phase))"
      )
      return
    }
    guard model.geometryReady else {
      if sample.phase != .changed {
        IntensityDebugLogger.log(
          "vertical",
          "hold sample buffered until geometryReady phase=\(String(describing: sample.phase)) originTag=\(String(describing: originViewTag)) targetTag=\(String(describing: targetViewTag))"
        )
      }
      if sample.phase == .began {
        pendingSendHoldStart = sample
      }
      pendingSendHoldLatest = sample
      return
    }
    applySendHoldSample(sample)
  }

  private func applyPendingSendHoldSamplesIfReady() {
    guard model.geometryReady else {
      if pendingSendHoldStart != nil || pendingSendHoldLatest != nil {
        logGeometryDiagnosticOnce(
          key: "pending-hold-geometry-false-\(interactionSessionId ?? "nil")",
          message: "pending hold samples retained because geometryReady=false sessionId=\(String(describing: interactionSessionId))"
        )
      }
      return
    }
    let start = pendingSendHoldStart
    let latest = pendingSendHoldLatest
    pendingSendHoldStart = nil
    pendingSendHoldLatest = nil
    if start != nil || latest != nil {
      IntensityDebugLogger.log(
        "vertical",
        "replaying buffered hold samples start=\(start != nil) latestPhase=\(latest.map { String(describing: $0.phase) } ?? "nil") geometryReady=\(model.geometryReady)"
      )
    }
    if let start {
      applySendHoldSample(start)
    }
    if let latest, latest.phase != .began {
      applySendHoldSample(latest)
    }
  }

  private func applySendHoldSample(_ sample: NativeSendHoldSample) {
    guard sample.sessionId == interactionSessionId else {
      logGeometryDiagnosticOnce(
        key: "apply-hold-session-mismatch-\(sample.sessionId)",
        message: "hold sample application rejected: session mismatch incoming=\(sample.sessionId) active=\(String(describing: interactionSessionId))"
      )
      if sample.phase == .cancelled || sample.phase == .ended {
        sendHoldStartPoint = nil
      }
      return
    }
    guard let hostWindow = window else {
      logGeometryDiagnosticOnce(
        key: "hold-host-window-nil-\(sample.sessionId)",
        message: "hold sample application rejected: host UIWindow nil phase=\(String(describing: sample.phase))"
      )
      if sample.phase == .cancelled || sample.phase == .ended { sendHoldStartPoint = nil }
      return
    }
    guard let pointInWindow = IntensityCoordinateConverter.convertScreenPoint(
      sample.locationOnScreen,
      from: sample.sourceScreen,
      to: hostWindow
    ) else {
      let screenGeometryFailure = IntensityCoordinateConverter.incompatibilityReason(
        sourceScreen: sample.sourceScreen,
        destinationScreen: hostWindow.screen
      ) ?? "screen point conversion produced a non-finite coordinate"
      logGeometryDiagnosticOnce(
        key: "hold-screen-mismatch-\(sample.sessionId)-\(ObjectIdentifier(hostWindow))",
        message: "hold sample application rejected: incompatible display geometry reason=\(screenGeometryFailure) sourceScreenId=\(ObjectIdentifier(sample.sourceScreen)) sourceGeometry={\(IntensityScreenGeometry(screen: sample.sourceScreen).diagnosticDescription)} hostGeometry={\(IntensityScreenGeometry(screen: hostWindow.screen).diagnosticDescription)} hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} phase=\(String(describing: sample.phase))"
      )
      if sample.phase == .cancelled || sample.phase == .ended { sendHoldStartPoint = nil }
      return
    }

    let pointInView = convert(pointInWindow, from: hostWindow)
    let travel = SendIntensityPickerGeometry.availableVerticalTravel()
    if sample.phase != .changed {
      IntensityDebugLogger.log(
        "vertical",
        "hold coordinate conversion phase=\(String(describing: sample.phase)) screenPoint=\(sample.locationOnScreen) windowPoint=\(pointInWindow) expoViewPoint=\(pointInView) travel=\(travel) hostWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} expoBounds=\(bounds)"
      )
    }

    switch sample.phase {
    case .began:
      sendHoldStartPoint = pointInView
      sendHoldStartProgress = model.currentProgress
      model.beginInteraction(at: sendHoldStartProgress)
    case .changed:
      if sendHoldStartPoint == nil {
        sendHoldStartPoint = pointInView
        sendHoldStartProgress = model.currentProgress
        model.beginInteraction(at: sendHoldStartProgress)
      }
      guard let startPoint = sendHoldStartPoint else {
        logGeometryDiagnosticOnce(
          key: "changed-without-hold-start-\(sample.sessionId)",
          message: "hold changed sample ignored: start point missing sessionId=\(sample.sessionId)"
        )
        return
      }
      let progress = sendHoldStartProgress - (pointInView.y - startPoint.y) / travel
      model.updateInteraction(progress: progress)
    case .ended:
      if sendHoldStartPoint == nil {
        sendHoldStartPoint = pointInView
        sendHoldStartProgress = model.currentProgress
        model.beginInteraction(at: sendHoldStartProgress)
      }
      guard let startPoint = sendHoldStartPoint else {
        logGeometryDiagnosticOnce(
          key: "ended-without-hold-start-\(sample.sessionId)",
          message: "hold ended sample ignored: start point missing sessionId=\(sample.sessionId)"
        )
        return
      }
      let progress = sendHoldStartProgress - (pointInView.y - startPoint.y) / travel
      sendHoldStartPoint = nil
      model.endInteraction(progress: progress, animated: !UIAccessibility.isReduceMotionEnabled)
    case .cancelled:
      sendHoldStartPoint = nil
      model.cancelInteraction()
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
        "vertical",
        "coordinate conversion role=\(role) view={\(IntensityDebugLogger.describeView(view))} sourceWindow={\(IntensityDebugLogger.describeWindow(sourceWindow))} destinationWindow={\(IntensityDebugLogger.describeWindow(hostWindow))} sameScene=\(IntensityDebugLogger.sameWindowScene(sourceWindow, hostWindow)) screenInstancesIdentical=\(sourceScreen === hostScreen) geometryCompatible=true sourceScreenGeometry={\(IntensityScreenGeometry(screen: sourceScreen).diagnosticDescription)} destinationScreenGeometry={\(IntensityScreenGeometry(screen: hostScreen).diagnosticDescription)} sourceBounds=\(view.bounds) sourceWindowFrame=\(rectInSourceWindow) screenFrame=\(rectOnScreen) hostWindowFrame=\(rectInHostWindow) expoViewFrame=\(localFrame) finite=\(IntensityDebugLogger.isFinite(localFrame)) visibleOnScreen=\(rectOnScreen.intersects(sourceScreen.bounds)) visibleInHost=\(rectInHostWindow.intersects(hostWindow.bounds))"
      )
    }
    return localFrame
  }

  private func logGeometryDiagnosticOnce(key: String, message: String) {
    guard loggedGeometryDiagnosticKeys.insert(key).inserted else { return }
    IntensityDebugLogger.log("vertical", message)
  }

  private func isNearlyEqual(_ lhs: CGRect, _ rhs: CGRect) -> Bool {
    let tolerance: CGFloat = 0.25
    return abs(lhs.minX - rhs.minX) < tolerance
      && abs(lhs.minY - rhs.minY) < tolerance
      && abs(lhs.width - rhs.width) < tolerance
      && abs(lhs.height - rhs.height) < tolerance
  }
}
