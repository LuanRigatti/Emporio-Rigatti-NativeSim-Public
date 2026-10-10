import ExpoModulesCore
import Foundation
import os

public final class NativeWidgetDiagnosticsModule: Module {
  private let logger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "NativeWidgetDiagnostics",
    category: "RigattiWidgetSync"
  )

  public func definition() -> ModuleDefinition {
    Name("NativeWidgetDiagnostics")

    Function("publishStart") {
      (
        entryCount: Int,
        wholesaleRevenueAvailable: Bool,
        wholesaleProfitAvailable: Bool,
        retailRevenueAvailable: Bool,
        retailProfitAvailable: Bool
      ) in
      self.logger.info(
        "event=publish_start source=app entry_count=\(entryCount, privacy: .public) wholesale_revenue_available=\(wholesaleRevenueAvailable, privacy: .public) wholesale_profit_available=\(wholesaleProfitAvailable, privacy: .public) retail_revenue_available=\(retailRevenueAvailable, privacy: .public) retail_profit_available=\(retailProfitAvailable, privacy: .public)"
      )
    }

    Function("publishResult") {
      (
        success: Bool,
        stage: String,
        errorType: String?,
        errorDomain: String?,
        errorCode: String?
      ) in
      let safeStage = ["update_timeline", "widget_module_load"].contains(stage)
        ? stage
        : "unknown"
      let safeErrorType = self.sanitizeErrorType(errorType)
      let safeErrorDomain = self.sanitizeErrorDomain(errorDomain)
      let safeErrorCode = self.sanitizeErrorCode(errorCode)
      let errorFields = [
        safeErrorType.map { "error_type=\($0)" },
        safeErrorDomain.map { "error_domain=\($0)" },
        safeErrorCode.map { "error_code=\($0)" },
      ]
      .compactMap { $0 }
      .joined(separator: " ")

      let publishResultEvent =
        "event=publish_result source=app success=\(success) stage=\(safeStage)"
      if errorFields.isEmpty {
        self.logger.info("\(publishResultEvent, privacy: .public)")
      } else {
        self.logger.info("\(publishResultEvent, privacy: .public) \(errorFields, privacy: .public)")
      }
    }

    Function("timelineRead") { (success: Bool, entryCount: Int, validEntryCount: Int) in
      self.logger.info(
        "event=timeline_read source=app success=\(success, privacy: .public) entry_count=\(entryCount, privacy: .public) valid_entry_count=\(validEntryCount, privacy: .public)"
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
