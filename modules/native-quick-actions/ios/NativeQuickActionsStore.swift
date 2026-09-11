import Foundation

let nativeQuickActionReceivedNotification = Notification.Name("NativeQuickActionsReceived")

final class NativeQuickActionsStore: NSObject {
  static let shared = NativeQuickActionsStore()

  private let lock = NSLock()
  private var isObserving = false
  private var pendingTypes: [String] = []

  func startObserving() -> [String] {
    lock.lock()
    isObserving = true
    let pending = pendingTypes
    pendingTypes.removeAll()
    lock.unlock()
    return pending
  }

  func stopObserving() {
    lock.lock()
    isObserving = false
    lock.unlock()
  }

  func receive(type: String) {
    guard !type.isEmpty else { return }

    lock.lock()
    let shouldNotify = isObserving
    if !shouldNotify {
      pendingTypes.append(type)
    }
    lock.unlock()

    guard shouldNotify else { return }

    DispatchQueue.main.async {
      NotificationCenter.default.post(
        name: nativeQuickActionReceivedNotification,
        object: nil,
        userInfo: ["type": type]
      )
    }
  }

}
