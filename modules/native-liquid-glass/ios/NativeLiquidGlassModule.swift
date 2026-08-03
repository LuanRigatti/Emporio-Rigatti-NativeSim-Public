import ExpoModulesCore

public final class NativeLiquidGlassModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeLiquidGlass")

    View(NativeLiquidGlassView.self)
  }
}
