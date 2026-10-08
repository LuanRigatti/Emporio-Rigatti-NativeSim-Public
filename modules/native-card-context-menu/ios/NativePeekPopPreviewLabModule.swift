import ExpoModulesCore

public final class NativePeekPopPreviewLabModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativePeekPopPreviewLab")

    View(NativePeekPopPreviewLabView.self) {
      Events("onClose", "onAction", "onOpen")

      Prop("identifier") { (view: NativePeekPopPreviewLabView, identifier: String) in
        view.identifier = identifier
      }

      Prop("preview") { (view: NativePeekPopPreviewLabView, preview: [String: Any]) in
        view.previewContent = preview
      }

      Prop("actions") { (view: NativePeekPopPreviewLabView, actions: [[String: Any]]) in
        view.actions = actions
      }

      Prop("menuTitle") { (view: NativePeekPopPreviewLabView, menuTitle: String) in
        view.menuTitle = menuTitle
      }
    }
  }
}
