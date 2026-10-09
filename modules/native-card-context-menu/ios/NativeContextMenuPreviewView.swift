import ExpoModulesCore
import UIKit

public final class NativeContextMenuPreviewView: ExpoView {
  let onAction = EventDispatcher()
  let onOpen = EventDispatcher()

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
      commitBehavior: .pushPreviewController
    )
    coordinator?.navigationControllerProvider = { [weak self] in
      self?.nearestPresentationHost()?.navigationControllerForPreview()
    }
    coordinator?.presentationHostProvider = { [weak self] in
      self?.nearestPresentationHost()
    }
    coordinator?.onAction = { [weak self] identifier, actionId in
      self?.onAction(["identifier": identifier, "actionId": actionId])
    }
    coordinator?.onOpen = { [weak self] identifier, preview in
      self?.onOpen(["identifier": identifier, "preview": preview])
    }
    coordinator?.presentationStyle = presentationStyle
  }

  private func nearestPresentationHost() -> NativeOpenPaymentContextMenuHostView? {
    var currentView = superview
    while let view = currentView {
      if let host = view as? NativeOpenPaymentContextMenuHostView {
        return host
      }
      currentView = view.superview
    }
    return nil
  }
}
