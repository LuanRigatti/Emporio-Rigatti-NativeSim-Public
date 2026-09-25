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

      Prop("originViewTag") { (view: NativeModelIntensitySliderView, tag: Int) in
        view.setOriginViewTag(tag)
      }

      Prop("targetViewTag") { (view: NativeModelIntensitySliderView, tag: Int) in
        view.setTargetViewTag(tag)
      }

      Prop("geometryRevision") { (view: NativeModelIntensitySliderView, revision: Int) in
        view.setGeometryRevision(revision)
      }

      Events(
        "onStepChange",
        "onTransitionComplete",
        "onInteractionCommitted",
        "onDismissRequest",
        "onGeometryReady"
      )
    }
  }
}
