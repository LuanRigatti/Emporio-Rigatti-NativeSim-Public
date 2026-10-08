import ExpoModulesCore

public final class NativeContextMenuPreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeContextMenuPreview")

    View(NativeContextMenuPreviewView.self) {
      Events("onAction", "onOpen")

      Prop("identifier") { (view: NativeContextMenuPreviewView, identifier: String) in
        view.identifier = identifier
      }

      Prop("preview") { (view: NativeContextMenuPreviewView, preview: [String: Any]) in
        view.previewContent = preview
      }

      Prop("actions") { (view: NativeContextMenuPreviewView, actions: [[String: Any]]) in
        view.actions = actions
      }

      Prop("menuTitle") { (view: NativeContextMenuPreviewView, menuTitle: String) in
        view.menuTitle = menuTitle
      }
    }
  }
}
