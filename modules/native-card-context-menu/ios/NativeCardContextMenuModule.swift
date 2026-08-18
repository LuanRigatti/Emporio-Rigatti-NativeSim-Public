import ExpoModulesCore

public final class NativeCardContextMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeCardContextMenu")

    View(NativeCardContextMenuView.self) {
      Events("onAction")

      Prop("actions") { (view: NativeCardContextMenuView, actions: [[String: Any]]) in
        view.actions = actions
      }

      Prop("cornerRadius") { (view: NativeCardContextMenuView, cornerRadius: Double) in
        view.cornerRadius = CGFloat(cornerRadius)
      }

      Prop("title") { (view: NativeCardContextMenuView, title: String) in
        view.menuTitle = title
      }
    }
  }
}
