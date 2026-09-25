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

    if animated {
      withAnimation(.spring(response: 0.34, dampingFraction: 0.9)) {
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
    onTransitionComplete?(isExpanded)
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
      VStack(spacing: 4) {
        Text(model.selectedStep.label)
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(.primary)
          .frame(maxWidth: .infinity, alignment: .center)
          .opacity(model.isExpanded ? 1 : 0)
          .animation(reduceMotion ? nil : .easeInOut(duration: 0.14), value: model.isExpanded)
          .id(model.selectedStep)
          .transition(
            reduceMotion
              ? .identity
              : .opacity.combined(with: .scale(scale: 0.98, anchor: .center))
          )
          .animation(reduceMotion ? nil : .easeInOut(duration: 0.16), value: model.selectedStep)

        NativeModelIntensitySliderTrack(
          selectedStep: model.selectedStep,
          accentColor: accentColor,
          colorScheme: model.colorScheme,
          onDragStart: model.prepareSelectionFeedback,
          onStepChange: { model.setSelectedStep($0, notify: true) },
          onInteractionCommitted: { model.commitInteraction($0) }
        )
        .frame(
          width: model.isExpanded ? geometry.size.width : 0,
          height: SliderGeometry.trackHeight
        )
        .frame(maxWidth: .infinity, alignment: .center)
        .background {
          GeometryReader { trackGeometry in
            Color.clear.preference(
              key: SliderTrackFramePreferenceKey.self,
              value: trackGeometry.frame(in: .named(Self.coordinateSpaceName))
            )
          }
        }
        .opacity(model.isExpanded ? 1 : 0)
        .allowsHitTesting(model.isExpanded)
        .animation(
          reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.9),
          value: model.isExpanded
        )
      }
      .frame(width: geometry.size.width, height: geometry.size.height)
    }
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
  static let trackHeight: CGFloat = 56
  static let thumbDiameter: CGFloat = 48
  static let markerDiameter: CGFloat = 3
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
  let onDragStart: () -> Void
  let onStepChange: (ModelIntensityStep) -> Void
  let onInteractionCommitted: (ModelIntensityStep) -> Void

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var dragProgress: CGFloat = 0.5
  @State private var isDragging = false
  @State private var isSnapping = false
  @State private var snapAnimationValue: CGFloat = 0
  @State private var snapGeneration = 0
  @State private var pendingCommitStep: ModelIntensityStep?
  @State private var pendingCommitGeneration: Int?

  private var thumbSize: CGFloat { SliderGeometry.thumbDiameter }

  private var currentProgress: CGFloat {
    isDragging || isSnapping ? dragProgress : CGFloat(selectedStep.index) / 2
  }

  private var isGestureActive: Bool {
    isDragging || isSnapping
  }

  private var shellTint: Color {
    Color.black.opacity(colorScheme == "dark" ? 0.24 : 0.30)
  }

  private var shellRim: LinearGradient {
    let highlightOpacity = colorScheme == "dark" ? 0.30 : 0.48
    let edgeOpacity = colorScheme == "dark" ? 0.12 : 0.22
    return LinearGradient(
      colors: [Color.white.opacity(highlightOpacity), Color.white.opacity(edgeOpacity)],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }

  var body: some View {
    GeometryReader { geometry in
      let width = geometry.size.width
      let available = max(width - thumbSize, 0)
      let thumbCenter = thumbSize / 2 + currentProgress * available

      ZStack(alignment: .leading) {
        trackShell(width: width)

        Capsule()
          .fill(
            LinearGradient(
              colors: [accentColor.opacity(0.94), accentColor],
              startPoint: .leading,
              endPoint: .trailing
            )
          )
          .frame(width: thumbCenter, height: SliderGeometry.trackHeight)
          .overlay {
            Capsule().strokeBorder(Color.white.opacity(0.16), lineWidth: 0.7)
          }

        ForEach(ModelIntensityStep.allCases, id: \.rawValue) { step in
          Circle()
            .fill(Color.white.opacity(step.index <= selectedStep.index ? 0.3 : 0.5))
            .frame(width: SliderGeometry.markerDiameter, height: SliderGeometry.markerDiameter)
            .position(
              x: thumbSize / 2 + CGFloat(step.index) / 2 * available,
              y: geometry.size.height / 2
            )
            .accessibilityHidden(true)
        }

        Circle()
          .fill(
            LinearGradient(
              colors: [Color.white, Color.white.opacity(0.88)],
              startPoint: .topLeading,
              endPoint: .bottomTrailing
            )
          )
          .frame(width: thumbSize, height: thumbSize)
          .overlay {
            Circle().strokeBorder(Color.black.opacity(0.06), lineWidth: 0.6)
          }
          .shadow(
            color: .black.opacity(colorScheme == "dark" ? 0.28 : 0.18),
            radius: 3,
            x: 0,
            y: 1
          )
          .scaleEffect(x: isGestureActive ? 1.06 : 1, y: isGestureActive ? 0.97 : 1)
          .animation(
            reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.84),
            value: isGestureActive
          )
          .position(x: thumbCenter, y: geometry.size.height / 2)
          .accessibilityHidden(true)
      }
      .frame(width: width, height: geometry.size.height)
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

            let progress = min(max((event.location.x - thumbSize / 2) / max(available, 1), 0), 1)
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
              dragProgress = progress
            }
            onStepChange(.from(index: Int((progress * 2).rounded())))
          }
          .onEnded { event in
            let progress = min(max((event.location.x - thumbSize / 2) / max(available, 1), 0), 1)
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
                dragProgress = target
                isDragging = false
                isSnapping = true
                snapAnimationValue = CGFloat(generation)
              }
              completeSnapIfPending(generation)
            } else {
              withAnimation(.spring(response: 0.28, dampingFraction: 0.94)) {
                dragProgress = target
                isDragging = false
                isSnapping = true
                snapAnimationValue = CGFloat(generation)
              }
            }
          }
      )
    }
    .frame(height: SliderGeometry.trackHeight)
    .modifier(
      AnimationCompletionObserver(
        value: snapAnimationValue,
        generation: snapGeneration,
        onCompletion: completeSnapIfPending
      )
    )
    .accessibilityHidden(true)
  }

  @ViewBuilder
  private func trackShell(width: CGFloat) -> some View {
    if #available(iOS 26.0, *) {
      Capsule()
        .fill(Color.clear)
        .frame(width: width, height: SliderGeometry.trackHeight)
        .glassEffect(.regular.tint(shellTint).interactive(), in: Capsule())
        .overlay {
          Capsule().strokeBorder(shellRim, lineWidth: 0.8)
        }
    } else {
      Capsule()
        .fill(.ultraThinMaterial)
        .overlay {
          Capsule().fill(shellTint)
        }
        .frame(width: width, height: SliderGeometry.trackHeight)
        .overlay {
          Capsule().strokeBorder(shellRim, lineWidth: 0.8)
        }
    }
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

  public let onStepChange = EventDispatcher()
  public let onTransitionComplete = EventDispatcher()
  public let onInteractionCommitted = EventDispatcher()
  public let onDismissRequest = EventDispatcher()

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
    guard window != nil, let expanded = pendingExpandedValue else { return }
    pendingExpandedValue = nil
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.model.setExpanded(expanded, animated: !UIAccessibility.isReduceMotionEnabled)
    }
  }

  func setExpanded(_ expanded: Bool) {
    guard model.isExpanded != expanded else { return }
    guard window != nil else {
      pendingExpandedValue = expanded
      return
    }
    model.setExpanded(expanded, animated: !UIAccessibility.isReduceMotionEnabled)
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
}
