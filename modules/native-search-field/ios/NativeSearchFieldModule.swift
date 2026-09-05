import ExpoModulesCore

public final class NativeSearchFieldModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeSearchField")

    View(NativeSearchFieldView.self) {
      Events("onTextChange", "onFocusChange", "onSubmit", "onPressHelp")

      Prop("accessibilityLabel") { (view: NativeSearchFieldView, value: String) in
        view.accessibilityLabel = value
      }

      Prop("autoFocus") { (view: NativeSearchFieldView, value: Bool) in
        view.autoFocus = value
      }

      Prop("placeholder") { (view: NativeSearchFieldView, value: String) in
        view.placeholder = value
      }

      Prop("value") { (view: NativeSearchFieldView, value: String) in
        view.value = value
      }

      AsyncFunction("blur") { (view: NativeSearchFieldView) in
        view.blur()
      }

      AsyncFunction("clear") { (view: NativeSearchFieldView) in
        view.clear()
      }

      AsyncFunction("focus") { (view: NativeSearchFieldView) in
        view.focus()
      }
    }
  }
}
