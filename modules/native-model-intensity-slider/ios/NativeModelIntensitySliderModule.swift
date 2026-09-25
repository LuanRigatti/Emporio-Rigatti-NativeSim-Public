import ExpoModulesCore

public class NativeModelIntensitySliderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeModelIntensitySlider")

    View(NativeModelIntensitySliderView.self) {
      Prop("expanded") { (view: NativeModelIntensitySliderView, expanded: Bool) in
        view.setExpanded(expanded)
      }

      Prop("selectedStep") { (view: NativeModelIntensitySliderView, step: String) in
        view.setSelectedStep(step)
      }

      Prop("colorScheme") { (view: NativeModelIntensitySliderView, colorScheme: String) in
        view.setColorScheme(colorScheme)
      }

      Prop("accentColor") { (view: NativeModelIntensitySliderView, accentColor: String) in
        view.setAccentColor(accentColor)
      }

      Events("onStepChange", "onTransitionComplete")
    }
  }
}
