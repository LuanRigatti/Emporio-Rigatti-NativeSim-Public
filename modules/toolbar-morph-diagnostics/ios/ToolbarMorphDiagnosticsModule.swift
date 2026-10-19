import ExpoModulesCore
import Foundation
import os

public final class ToolbarMorphDiagnosticsModule: Module {
  private let logger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",
    category: "ToolbarMorphDiagnostics"
  )

  private var diagnosticsEnabled: Bool {
    #if DEBUG
    return true
    #else
    return (Bundle.main.infoDictionary?["EmporioToolbarMorphDiagnosticsEnabled"] as? Bool) == true
    #endif
  }

  public func definition() -> ModuleDefinition {
    Name("ToolbarMorphDiagnostics")

    Constant("diagnosticsEnabled") { self.diagnosticsEnabled }

    Function("recordAccessoryLifecycle") {
      (role: String, event: String, instance: Int) in
      guard self.diagnosticsEnabled else { return }
      let safeRole = ["home-search", "settings-profile"].contains(role) ? role : "unknown"
      let safeEvent = ["accessory_mount", "accessory_unmount"].contains(event) ? event : "unknown"
      let safeInstance = max(0, min(instance, 1_000_000))
      let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
      let processIdentifier = ProcessInfo.processInfo.processIdentifier
      self.logger.info(
        "event=\(safeEvent, privacy: .public) role=\(safeRole, privacy: .public) react_instance=\(safeInstance, privacy: .public) pid=\(processIdentifier, privacy: .public) uptime_ms=\(uptimeMilliseconds, privacy: .public)"
      )
    }

    Function("recordNavigationLifecycle") {
      (event: String, destination: String) in
      guard self.diagnosticsEnabled else { return }
      let safeEvent = ["splash_replace_requested"].contains(event) ? event : "unknown"
      let safeDestination = ["home", "login"].contains(destination) ? destination : "unknown"
      let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
      let processIdentifier = ProcessInfo.processInfo.processIdentifier
      self.logger.info(
        "event=\(safeEvent, privacy: .public) role=coordinator destination=\(safeDestination, privacy: .public) phase=before_replace pid=\(processIdentifier, privacy: .public) uptime_ms=\(uptimeMilliseconds, privacy: .public)"
      )
    }
  }
}
