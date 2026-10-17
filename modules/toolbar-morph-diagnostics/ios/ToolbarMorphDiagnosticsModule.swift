import ExpoModulesCore
import Foundation
import os

public final class ToolbarMorphDiagnosticsModule: Module {
  private let logger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",
    category: "ToolbarMorphDiagnostics"
  )

  public func definition() -> ModuleDefinition {
    Name("ToolbarMorphDiagnostics")

    Function("recordAccessoryLifecycle") {
      (role: String, event: String, instance: Int) in
      let safeRole = ["home-search", "settings-profile"].contains(role) ? role : "unknown"
      let safeEvent = ["accessory_mount", "accessory_unmount"].contains(event) ? event : "unknown"
      let safeInstance = max(0, min(instance, 1_000_000))
      let uptimeMilliseconds = Int(ProcessInfo.processInfo.systemUptime * 1_000)
      self.logger.info(
        "event=\(safeEvent, privacy: .public) role=\(safeRole, privacy: .public) react_instance=\(safeInstance, privacy: .public) uptime_ms=\(uptimeMilliseconds, privacy: .public)"
      )
    }
  }
}
