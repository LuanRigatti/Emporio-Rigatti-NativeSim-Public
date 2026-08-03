import ExpoModulesCore

public final class NativeStartupSplashModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeStartupSplash")
    View(NativeStartupSplashView.self)
  }
}
