import ExpoModulesCore
import Foundation
import os

public final class NativeWidgetDiagnosticsModule: Module {
  private let logger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "NativeWidgetDiagnostics",
    category: "RigattiWidgetSync"
  )
  private let deliveryLogger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",
    category: "DeliveryWidgetSnapshot"
  )
  private let widgetRuntimeLogger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",
    category: "WidgetRuntimeDiagnostics"
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

    Function("widgetRuntimeEvent") { (widgetName: String, event: String, success: Bool) in
      let safeWidgetName = ["ResumoFinanceiro", "EntregasDoDia"].contains(widgetName)
        ? widgetName
        : "unknown"
      let safeEvent = [
        "coordinator_started",
        "module_loaded",
        "module_load_failed",
        "timeline_publish_succeeded",
        "timeline_publish_failed",
      ].contains(event) ? event : "unknown"
      let groupIdentifier =
        Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
      let groupContainerAvailable = groupIdentifier.map {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) != nil
      } ?? false
      let sharedDefaults = groupIdentifier.flatMap { UserDefaults(suiteName: $0) }
      let layoutKey = "__expo_widgets_\(safeWidgetName)_layout"
      let timelineKey = "__expo_widgets_\(safeWidgetName)_timeline"
      let layoutPresent = sharedDefaults?.string(forKey: layoutKey).map { !$0.isEmpty } ?? false
      let timelinePresent = sharedDefaults?.array(forKey: timelineKey) != nil
      self.widgetRuntimeLogger.info(
        "event=widget_runtime widget=\(safeWidgetName, privacy: .public) stage=\(safeEvent, privacy: .public) success=\(success, privacy: .public) app_group_configured=\(groupIdentifier != nil, privacy: .public) app_group_container=\(groupContainerAvailable, privacy: .public) defaults_suite_available=\(sharedDefaults != nil, privacy: .public) layout_present=\(layoutPresent, privacy: .public) timeline_present=\(timelinePresent, privacy: .public)"
      )
    }

    Function("deliverySnapshotEvent") {
      (event: String, state: String, deliveryCount: Int, success: Bool) in
      let safeEvents = [
        "snapshot_refresh_started",
        "snapshot_invalidated",
        "snapshot_query_published",
        "snapshot_mutation_published",
        "snapshot_unavailable",
        "timeline_publish_started",
        "timeline_publish_succeeded",
        "timeline_publish_failed",
      ]
      let safeStates = ["pending", "all_completed", "empty", "unavailable"]
      let safeEvent = safeEvents.contains(event) ? event : "unknown"
      let safeState = safeStates.contains(state) ? state : "unknown"
      let safeCount = max(0, min(deliveryCount, 1000))
      self.deliveryLogger.info(
        "event=\(safeEvent, privacy: .public) state=\(safeState, privacy: .public) delivery_count=\(safeCount, privacy: .public) success=\(success, privacy: .public)"
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
