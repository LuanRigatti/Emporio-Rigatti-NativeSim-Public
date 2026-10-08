import UIKit

enum NativeContextMenuPreviewCommitBehavior {
  case callback
  case pushPreviewController
}

enum NativeContextMenuPreviewPresentationStyle: String {
  case page
  case expandedPanel
  case interactiveViewer
}

final class NativeContextMenuPreviewCoordinator: NSObject, UIContextMenuInteractionDelegate {
  private weak var hostView: UIView?
  private var interaction: UIContextMenuInteraction?

  var identifier = ""
  var previewContent: [String: Any] = [:]
  var actions: [[String: Any]] = []
  var menuTitle = ""
  var presentationStyle: NativeContextMenuPreviewPresentationStyle = .page
  var onAction: ((String, String) -> Void)?
  var onOpen: ((String, [String: Any]) -> Void)?
  var navigationControllerProvider: (() -> UINavigationController?)?

  private let commitBehavior: NativeContextMenuPreviewCommitBehavior

  init(
    attachingTo hostView: UIView,
    commitBehavior: NativeContextMenuPreviewCommitBehavior
  ) {
    self.hostView = hostView
    self.commitBehavior = commitBehavior
    super.init()

    let contextMenuInteraction = UIContextMenuInteraction(delegate: self)
    interaction = contextMenuInteraction
    hostView.addInteraction(contextMenuInteraction)
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configurationForMenuAtLocation location: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard !identifier.isEmpty else {
      return nil
    }

    let cardIdentifier = identifier
    let content = previewContent
    let style = presentationStyle
    let actionItems = actions
    let sourceView = hostView

    return UIContextMenuConfiguration(
      identifier: cardIdentifier as NSString,
      previewProvider: {
        let previewController = NativeContextMenuPreviewViewController(
          content: content,
          presentationStyle: style
        )
        if style == .interactiveViewer {
          previewController.transitionSourceView = sourceView
        }
        return previewController
      }
    ) { [weak self] _ in
      self?.makeMenu(actions: actionItems, cardIdentifier: cardIdentifier) ?? UIMenu()
    }
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willPerformPreviewActionForMenuWith configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionCommitAnimating
  ) {
    animator.preferredCommitStyle = .pop

    guard let previewController = animator.previewViewController else {
      return
    }

    let cardIdentifier = identifier
    let content = previewContent

    switch commitBehavior {
    case .callback:
      animator.addCompletion { [weak self] in
        self?.onOpen?(cardIdentifier, content)
      }
    case .pushPreviewController:
      guard let navigationController = navigationControllerProvider?() else {
        animator.addCompletion { [weak self] in
          self?.onOpen?(cardIdentifier, content)
        }
        return
      }

      animator.addAnimations {
        let isAlreadyPresented = navigationController.viewControllers.contains {
          $0 === previewController
        }
        if !isAlreadyPresented {
          if previewController.usesInteractiveViewer {
            previewController.prepareForInteractiveViewer(in: navigationController)
          }
          navigationController.pushViewController(previewController, animated: false)
        }
      }
      animator.addCompletion { [weak self] in
        self?.onOpen?(cardIdentifier, content)
      }
    }
  }

  private func makeMenu(
    actions: [[String: Any]],
    cardIdentifier: String
  ) -> UIMenu {
    var menuElements: [UIMenuElement] = []

    for action in actions {
      guard let actionIdentifier = action["id"] as? String,
            let title = action["title"] as? String else {
        continue
      }

      let systemImage = action["systemImage"] as? String
      let destructive = (action["destructive"] as? Bool) ?? false
      let disabled = (action["disabled"] as? Bool) ?? false

      var attributes: UIMenuElement.Attributes = []
      if destructive {
        attributes.insert(.destructive)
      }
      if disabled {
        attributes.insert(.disabled)
      }

      let image = systemImage.flatMap { UIImage(systemName: $0) }
      let menuAction = UIAction(
        title: title,
        image: image,
        identifier: nil,
        attributes: attributes
      ) { [weak self] _ in
        self?.onAction?(cardIdentifier, actionIdentifier)
      }

      menuElements.append(menuAction)
    }

    if menuTitle.isEmpty {
      return UIMenu(children: menuElements)
    }
    return UIMenu(title: menuTitle, children: menuElements)
  }
}
