import Combine
import ExpoModulesCore
import SwiftUI
import UIKit

final class NativeSearchFieldModel: ObservableObject {
  @Published var accessibilityLabel = "Pesquisar"
  @Published var autoFocus = false
  @Published var isFocused = false
  @Published var placeholder = "Pesquisar"
  @Published var text = ""

  var onFocusChange: ((Bool) -> Void)?
  var onPressHelp: (() -> Void)?
  var onSubmit: ((String) -> Void)?
  var onTextChange: ((String) -> Void)?

  func setExternalText(_ nextText: String) {
    guard text != nextText else { return }
    text = nextText
  }

  func updateFromUser(_ nextText: String) {
    guard text != nextText else { return }
    text = nextText
    onTextChange?(nextText)
  }

  func clear() {
    updateFromUser("")
  }

  func requestFocus() {
    DispatchQueue.main.async { [weak self] in
      self?.setFocused(true)
    }
  }

  func requestBlur() {
    DispatchQueue.main.async { [weak self] in
      self?.setFocused(false)
    }
  }

  func setFocused(_ nextFocused: Bool) {
    guard isFocused != nextFocused else { return }
    isFocused = nextFocused
    onFocusChange?(nextFocused)
  }

  func submit() {
    onSubmit?(text)
  }

  func pressHelp() {
    onPressHelp?()
  }
}

private enum NativeSearchFieldFocusTarget: Hashable {
  case accessory
  case inline
}

private struct NativeSearchFieldContent: View {
  @FocusState private var focusTarget: NativeSearchFieldFocusTarget?
  @ObservedObject var model: NativeSearchFieldModel

  var body: some View {
    Group {
      if model.isFocused {
        Color.clear
          .frame(height: 52)
      } else {
        searchBar(focusTarget: .inline)
      }
    }
    .frame(maxWidth: .infinity, minHeight: 52)
    .toolbar {
      ToolbarItem(placement: .keyboard) {
        if model.isFocused {
          searchBar(focusTarget: .accessory)
            .frame(maxWidth: .infinity)
        }
      }
    }
    .onAppear {
      if model.autoFocus {
        model.setFocused(true)
      }
    }
    .onChange(of: model.isFocused) { nextFocused in
      focusTarget = nextFocused ? .accessory : nil
    }
    .onChange(of: focusTarget) { nextTarget in
      let nextFocused = nextTarget != nil
      if model.isFocused != nextFocused {
        model.setFocused(nextFocused)
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(model.accessibilityLabel)
  }

  private var textBinding: Binding<String> {
    Binding(
      get: { model.text },
      set: { model.updateFromUser($0) }
    )
  }

  @ViewBuilder
  private func searchBar(focusTarget target: NativeSearchFieldFocusTarget) -> some View {
    let content = HStack(spacing: 20) {
      Image(systemName: "magnifyingglass")
        .font(.system(size: 18, weight: .regular))
        .foregroundStyle(Color(red: 139 / 255, green: 139 / 255, blue: 147 / 255))
        .offset(x: 12)

      TextField(model.placeholder, text: textBinding)
        .focused($focusTarget, equals: target)
        .font(.system(size: 18, design: .rounded))
        .lineLimit(1)
        .submitLabel(.search)
        .textFieldStyle(.plain)
        .frame(maxWidth: .infinity)
        .onSubmit {
          model.submit()
        }

      if model.isFocused && model.text.isEmpty && model.onPressHelp != nil {
        Button {
          model.pressHelp()
        } label: {
          Image(systemName: "questionmark.circle")
            .font(.system(size: 18, weight: .regular))
            .foregroundStyle(Color(red: 139 / 255, green: 139 / 255, blue: 147 / 255))
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, minHeight: 36)
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .overlay {
      Capsule()
        .stroke(
          Color(uiColor: .separator),
          lineWidth: model.isFocused ? 1.2 : 0.5
        )
    }

    if #available(iOS 26.0, *) {
      content.glassEffect(.regular.interactive(), in: .capsule)
    } else {
      content.background(.ultraThinMaterial, in: Capsule())
    }
  }
}

public final class NativeSearchFieldView: ExpoView {
  private let model = NativeSearchFieldModel()
  private let onFocusChange = EventDispatcher()
  private let onPressHelp = EventDispatcher()
  private let onSubmit = EventDispatcher()
  private let onTextChange = EventDispatcher()
  private var hostingController: UIHostingController<NativeSearchFieldContent>?

  public override var accessibilityLabel: String? {
    didSet { model.accessibilityLabel = accessibilityLabel ?? "Pesquisar" }
  }

  var autoFocus: Bool = false {
    didSet { model.autoFocus = autoFocus }
  }

  var placeholder: String = "Pesquisar" {
    didSet { model.placeholder = placeholder }
  }

  var value: String = "" {
    didSet { model.setExternalText(value) }
  }

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    accessibilityLabel = "Pesquisar"

    model.onFocusChange = { [weak self] focused in
      self?.onFocusChange(["value": focused])
    }
    model.onPressHelp = { [weak self] in
      self?.onPressHelp([:])
    }
    model.onSubmit = { [weak self] value in
      self?.onSubmit(["value": value])
    }
    model.onTextChange = { [weak self] value in
      self?.onTextChange(["value": value])
    }

    let controller = UIHostingController(rootView: NativeSearchFieldContent(model: model))
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

  func blur() {
    model.requestBlur()
  }

  func clear() {
    model.clear()
  }

  func focus() {
    model.requestFocus()
  }
}
