import ExpoModulesCore
import Foundation

public final class NativeQuickActionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeQuickActions")

    Events("onQuickAction")

    OnStartObserving("onQuickAction") {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleQuickActionNotification(_:)),
        name: nativeQuickActionReceivedNotification,
        object: nil
      )
      let pendingTypes = NativeQuickActionsStore.shared.startObserving()
      for type in pendingTypes {
        DispatchQueue.main.async {
          self.sendEvent("onQuickAction", ["type": type])
        }
      }
    }

    OnStopObserving("onQuickAction") {
      NotificationCenter.default.removeObserver(
        self,
        name: nativeQuickActionReceivedNotification,
        object: nil
      )
      NativeQuickActionsStore.shared.stopObserving()
    }
  }

  @objc private func handleQuickActionNotification(_ notification: Notification) {
    guard let type = notification.userInfo?["type"] as? String else { return }
    sendEvent("onQuickAction", ["type": type])
  }
}
