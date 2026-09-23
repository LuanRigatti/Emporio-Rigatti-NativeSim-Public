import ExpoModulesCore
import SwiftUI
import UIKit

private final class NativeThinkingOrbModel: ObservableObject {
  @Published var state: OrbState = .searching
  @Published var size: Double = 20
  @Published var theme: OrbTheme = .light
}

private struct NativeThinkingOrbContent: View {
  @ObservedObject var model: NativeThinkingOrbModel

  var body: some View {
    ThinkingOrb(
      state: model.state,
      size: .px20,
      theme: model.theme,
      displaySize: model.size
    )
    .frame(width: CGFloat(model.size), height: CGFloat(model.size))
    .accessibilityHidden(true)
  }
}

public final class NativeThinkingOrbView: ExpoView {
  private let model = NativeThinkingOrbModel()
  private var hostingController: UIHostingController<NativeThinkingOrbContent>?

  var state: String = "searching" {
    didSet {
      model.state = OrbState(rawValue: state) ?? .searching
    }
  }

  var size: Double = 20 {
    didSet {
      model.size = max(1, size)
    }
  }

  var colorScheme: String = "light" {
    didSet {
      model.theme = colorScheme == "dark" ? .dark : .light
    }
  }

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear

    let controller = UIHostingController(rootView: NativeThinkingOrbContent(model: model))
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
}
