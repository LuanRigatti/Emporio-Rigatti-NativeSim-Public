import ExpoModulesCore

public final class NativeOpenPaymentContextMenuHostModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeOpenPaymentContextMenuHost")

    View(NativeOpenPaymentContextMenuHostView.self) {
      Events("onExpandedPreviewChange")

      Prop("active") { (view: NativeOpenPaymentContextMenuHostView, active: Bool) in
        view.active = active
      }
    }
  }
}
