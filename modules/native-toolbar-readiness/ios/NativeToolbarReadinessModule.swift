import ExpoModulesCore
import Foundation

private let homeToolbarReadyNotification = Notification.Name("com.emporio.rigatti.homeToolbar.ready")
private let homeToolbarCompositionKey = "com.emporio.rigatti.homeToolbar.expectedComposition"
private let homeToolbarReadyKey = "com.emporio.rigatti.homeToolbar.isReady"
private let homeToolbarRootDidShowKey = "com.emporio.rigatti.homeToolbar.rootDidShow"
private let homeToolbarReadinessTraceKey = "com.emporio.rigatti.homeToolbar.readinessTrace"

public final class NativeToolbarReadinessModule: Module {
  private var readinessObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("NativeToolbarReadiness")

    Events("onHomeToolbarReady")

    Function("beginHomeToolbarReadiness") { (composition: String) in
      let defaults = UserDefaults.standard
      defaults.set(composition, forKey: homeToolbarCompositionKey)
      defaults.set(false, forKey: homeToolbarReadyKey)
      defaults.set(false, forKey: homeToolbarRootDidShowKey)
      defaults.removeObject(forKey: homeToolbarReadinessTraceKey)
    }

    Function("setExpectedHomeToolbarComposition") { (composition: String) in
      let defaults = UserDefaults.standard
      guard defaults.string(forKey: homeToolbarCompositionKey) != composition else { return }
      defaults.set(composition, forKey: homeToolbarCompositionKey)
      defaults.set(false, forKey: homeToolbarReadyKey)
    }

    Function("logSplashHide") { (composition: String) in
      #if targetEnvironment(simulator)
      let trace = UserDefaults.standard.string(forKey: homeToolbarReadinessTraceKey) ?? "toolbar-state=unavailable"
      NSLog("[TOOLBAR-TRACE] splash.hide composition=%@ %@", composition, trace)
      #endif
    }

    OnStartObserving("onHomeToolbarReady") {
      guard self.readinessObserver == nil else { return }
      self.readinessObserver = NotificationCenter.default.addObserver(
        forName: homeToolbarReadyNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let composition = notification.userInfo?["composition"] as? String else { return }
        self?.sendEvent("onHomeToolbarReady", ["composition": composition])
      }

      let defaults = UserDefaults.standard
      guard defaults.bool(forKey: homeToolbarReadyKey),
            let composition = defaults.string(forKey: homeToolbarCompositionKey) else { return }
      DispatchQueue.main.async {
        self.sendEvent("onHomeToolbarReady", ["composition": composition])
      }
    }

    OnStopObserving("onHomeToolbarReady") {
      guard let observer = self.readinessObserver else { return }
      NotificationCenter.default.removeObserver(observer)
      self.readinessObserver = nil
    }
  }
}
