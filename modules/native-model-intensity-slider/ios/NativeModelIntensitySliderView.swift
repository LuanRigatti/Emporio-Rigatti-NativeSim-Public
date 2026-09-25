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

  var onStepChange: ((ModelIntensityStep) -> Void)?
  var onTransitionComplete: ((Bool) -> Void)?

  private var transitionPending = false
  private let selectionFeedback = UISelectionFeedbackGenerator()

  func setExpanded(_ expanded: Bool, animated: Bool) {
    guard isExpanded != expanded else { return }
    transitionPending = true

    if animated {
      withAnimation(.spring(response: 0.34, dampingFraction: 0.9)) {
        isExpanded = expanded
      }
    } else {
      isExpanded = expanded
      completeTransitionIfPending()
    }
  }

  func completeTransitionIfPending() {
    guard transitionPending else { return }
    transitionPending = false
    onTransitionComplete?(isExpanded)
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
          .transition(reduceMotion ? .identity : .opacity)
          .animation(
            reduceMotion ? nil : .easeInOut(duration: 0.12),
            value: model.selectedStep
          )

        NativeModelIntensitySliderTrack(
          selectedStep: model.selectedStep,
          accentColor: accentColor,
          colorScheme: model.colorScheme,
          onDragStart: model.prepareSelectionFeedback,
          onStepChange: { model.setSelectedStep($0, notify: true) }
        )
        .frame(width: model.isExpanded ? geometry.size.width : 0, height: 44)
        .frame(maxWidth: .infinity, alignment: .center)
        .opacity(model.isExpanded ? 1 : 0)
        .allowsHitTesting(model.isExpanded)
        .animation(
          reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.9),
          value: model.isExpanded
        )
      }
      .frame(width: geometry.size.width, height: geometry.size.height)
    }
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
    .accessibilityHidden(!model.isExpanded)
    .modifier(
      TransitionCompletionObserver(
        value: model.isExpanded ? 1 : 0,
        onCompletion: { model.completeTransitionIfPending() }
      )
    )
  }
}

private struct NativeModelIntensitySliderTrack: View {
  let selectedStep: ModelIntensityStep
  let accentColor: Color
  let colorScheme: String
  let onDragStart: () -> Void
  let onStepChange: (ModelIntensityStep) -> Void

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var dragProgress: CGFloat = 0.5
  @State private var isDragging = false

  private let thumbSize: CGFloat = 24
  private let visualTrackHeight: CGFloat = 9

  private var currentProgress: CGFloat {
    isDragging ? dragProgress : CGFloat(selectedStep.index) / 2
  }

  var body: some View {
    GeometryReader { geometry in
      let width = geometry.size.width
      let available = max(width - thumbSize, 0)
      let thumbCenter = thumbSize / 2 + currentProgress * available

      ZStack(alignment: .leading) {
        Capsule()
          .fill(Color.black.opacity(colorScheme == "dark" ? 0.82 : 0.88))
          .frame(width: width, height: visualTrackHeight)

        Capsule()
          .fill(accentColor)
          .frame(width: thumbCenter, height: visualTrackHeight)

        ForEach(ModelIntensityStep.allCases, id: \.rawValue) { step in
          Circle()
            .fill(Color.white.opacity(step.index <= selectedStep.index ? 0.3 : 0.5))
            .frame(width: 3, height: 3)
            .position(
              x: thumbSize / 2 + CGFloat(step.index) / 2 * available,
              y: geometry.size.height / 2
            )
            .accessibilityHidden(true)
        }

        Circle()
          .fill(Color.white)
          .frame(width: thumbSize, height: thumbSize)
          .shadow(color: .black.opacity(0.18), radius: 2, x: 0, y: 1)
          .position(x: thumbCenter, y: geometry.size.height / 2)
          .accessibilityHidden(true)
      }
      .frame(width: width, height: geometry.size.height)
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { event in
            if !isDragging {
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

            if reduceMotion {
              dragProgress = CGFloat(step.index) / 2
              isDragging = false
            } else {
              withAnimation(.spring(response: 0.24, dampingFraction: 0.86)) {
                dragProgress = CGFloat(step.index) / 2
                isDragging = false
              }
            }
          }
      )
    }
    .frame(height: 44)
    .accessibilityHidden(true)
  }
}

private struct TransitionCompletionObserver: ViewModifier, Animatable {
  var value: CGFloat
  let target: CGFloat
  let onCompletion: () -> Void

  var animatableData: CGFloat {
    get { value }
    set {
      value = newValue
      guard abs(newValue - target) < 0.001 else { return }
      DispatchQueue.main.async(execute: onCompletion)
    }
  }

  init(value: CGFloat, onCompletion: @escaping () -> Void) {
    self.value = value
    self.target = value
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

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear

    model.onStepChange = { [weak self] step in
      self?.onStepChange(["step": step.rawValue])
    }
    model.onTransitionComplete = { [weak self] expanded in
      self?.onTransitionComplete(["expanded": expanded])
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
