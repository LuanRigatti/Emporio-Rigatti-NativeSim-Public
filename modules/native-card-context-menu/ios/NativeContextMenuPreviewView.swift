import ExpoModulesCore
import UIKit

public final class NativeContextMenuPreviewView: ExpoView {
  let onAction = EventDispatcher()

  var identifier = "" {
    didSet { coordinator?.identifier = identifier }
  }
  var previewContent: [String: Any] = [:] {
    didSet { coordinator?.previewContent = previewContent }
  }
  var actions: [[String: Any]] = [] {
    didSet { coordinator?.actions = actions }
  }
  var menuTitle = "" {
    didSet { coordinator?.menuTitle = menuTitle }
  }
  var presentationStyle: NativeContextMenuPreviewPresentationStyle = .page {
    didSet { coordinator?.presentationStyle = presentationStyle }
  }

  private var coordinator: NativeContextMenuPreviewCoordinator?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    coordinator = NativeContextMenuPreviewCoordinator(
      attachingTo: self,
      commitBehavior: .dismissPreview
    )
    coordinator?.onAction = { [weak self] identifier, actionId in
      self?.onAction(["identifier": identifier, "actionId": actionId])
    }
    coordinator?.presentationStyle = presentationStyle
  }
}
