import ExpoModulesCore

public final class NativeThinkingOrbModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeThinkingOrb")

    View(NativeThinkingOrbView.self) {
      Prop("state") { (view: NativeThinkingOrbView, value: String) in
        view.state = value
      }

      Prop("size") { (view: NativeThinkingOrbView, value: Double) in
        view.size = value
      }

      Prop("colorScheme") { (view: NativeThinkingOrbView, value: String) in
        view.colorScheme = value
      }
    }
  }
}
