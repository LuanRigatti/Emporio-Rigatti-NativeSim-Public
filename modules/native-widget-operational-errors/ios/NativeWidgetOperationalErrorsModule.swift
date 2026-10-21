import ExpoModulesCore
import Foundation
import os

public final class NativeWidgetOperationalErrorsModule: Module {
  private let logger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",
    category: "WidgetOperationalErrors"
  )

  public func definition() -> ModuleDefinition {
    Name("NativeWidgetOperationalErrors")

    Function("recordFailure") {
      (event: String, stage: String, errorType: String?, errorDomain: String?, errorCode: String?) in
      let safeEvents = [
        "delivery_timeline_publish_failed",
        "delivery_widget_module_load_failed",
        "finance_timeline_publish_failed",
        "finance_widget_module_load_failed",
      ]
      let safeStages = ["update_timeline", "widget_module_load"]
      guard safeEvents.contains(event), safeStages.contains(stage) else { return }

      let safeErrorType = self.sanitizeErrorType(errorType) ?? "unknown"
      let safeErrorDomain = self.sanitizeErrorDomain(errorDomain) ?? "unknown"
      let safeErrorCode = self.sanitizeErrorCode(errorCode) ?? "unknown"
      self.logger.error(
        "event=\(event, privacy: .public) stage=\(stage, privacy: .public) error_type=\(safeErrorType, privacy: .public) error_domain=\(safeErrorDomain, privacy: .public) error_code=\(safeErrorCode, privacy: .public)"
      )
    }
  }

  private func sanitizeErrorType(_ value: String?) -> String? {
    guard let value,
      value.range(of: "^[A-Z][A-Za-z0-9]{0,63}$", options: .regularExpression) != nil
    else {
      return nil
    }
    return value
  }

  private func sanitizeErrorDomain(_ value: String?) -> String? {
    let safeDomains = [
      "EXErrorDomain",
      "ExpoModulesCore",
      "NSCocoaErrorDomain",
      "NSOSStatusErrorDomain",
      "NSPOSIXErrorDomain",
      "WidgetKit",
    ]
    guard let value, safeDomains.contains(value) else { return nil }
    return value
  }

  private func sanitizeErrorCode(_ value: String?) -> String? {
    guard let value,
      value.range(of: "^(ERR_[A-Z0-9_]{1,60}|-?[0-9]{1,6})$", options: .regularExpression) != nil
    else {
      return nil
    }
    return value
  }
}
