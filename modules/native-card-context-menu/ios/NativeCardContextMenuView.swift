import ExpoModulesCore
import UIKit

public final class NativeCardContextMenuView: ExpoView, UIContextMenuInteractionDelegate {
  private let onAction = EventDispatcher()
  private var interaction: UIContextMenuInteraction?

  var actions: [[String: Any]] = []
  var cornerRadius: CGFloat = 0
  var menuTitle: String = ""

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let contextMenuInteraction = UIContextMenuInteraction(delegate: self)
    self.interaction = contextMenuInteraction
    self.addInteraction(contextMenuInteraction)
  }

  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configurationForMenuAtLocation location: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard !actions.isEmpty else {
      return nil
    }

    return UIContextMenuConfiguration(
      identifier: nil,
      previewProvider: nil
    ) { [weak self] _ in
      guard let self = self else { return UIMenu() }
      return self.buildMenu()
    }
  }

  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    previewForHighlightingMenuWithConfiguration configuration: UIContextMenuConfiguration
  ) -> UITargetedPreview? {
    return makeTargetedPreview()
  }

  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    previewForDismissingMenuWithConfiguration configuration: UIContextMenuConfiguration
  ) -> UITargetedPreview? {
    return makeTargetedPreview()
  }

  private func makeTargetedPreview() -> UITargetedPreview? {
    guard bounds.width > 0, bounds.height > 0, let superview = self.superview else {
      return nil
    }

    let target = UIPreviewTarget(container: superview, center: self.center)
    let parameters = UIPreviewParameters()

    if cornerRadius > 0 {
      parameters.visiblePath = UIBezierPath(roundedRect: bounds, cornerRadius: cornerRadius)
    } else {
      parameters.visiblePath = UIBezierPath(rect: bounds)
    }
    parameters.backgroundColor = .clear

    return UITargetedPreview(view: self, parameters: parameters, target: target)
  }

  private func buildMenu() -> UIMenu {
    var menuElements: [UIMenuElement] = []

    for action in actions {
      guard let id = action["id"] as? String,
            let title = action["title"] as? String else {
        continue
      }

      let systemImage = action["systemImage"] as? String
      let destructive = (action["destructive"] as? Bool) ?? false
      let disabled = (action["disabled"] as? Bool) ?? false

      var image: UIImage? = nil
      if let systemImage = systemImage, !systemImage.isEmpty {
        image = UIImage(systemName: systemImage)
      }

      var attributes: UIMenuElement.Attributes = []
      if destructive {
        attributes.insert(.destructive)
      }
      if disabled {
        attributes.insert(.disabled)
      }

      let uiAction = UIAction(
        title: title,
        image: image,
        identifier: nil,
        attributes: attributes
      ) { [weak self] _ in
        self?.onAction(["id": id])
      }

      menuElements.append(uiAction)
    }

    if !menuTitle.isEmpty {
      return UIMenu(title: menuTitle, children: menuElements)
    }
    return UIMenu(children: menuElements)
  }
}
