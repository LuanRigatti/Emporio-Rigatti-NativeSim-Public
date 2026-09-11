import ExpoModulesCore

public final class NativeInteractivePagerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeInteractivePager")
    View(NativeInteractivePagerView.self)
    View(NativeInteractivePagerPage.self)
  }
}
