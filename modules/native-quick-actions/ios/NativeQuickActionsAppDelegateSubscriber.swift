import ExpoModulesCore
import UIKit

public final class NativeQuickActionsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    guard let shortcutItem = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem else {
      return false
    }

    NativeQuickActionsStore.shared.receive(type: shortcutItem.type)
    return false
  }

  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    NativeQuickActionsStore.shared.receive(type: shortcutItem.type)
    completionHandler(true)
  }
}
