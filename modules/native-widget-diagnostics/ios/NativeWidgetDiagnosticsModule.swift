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

    Function("publishResult") { (success: Bool, stage: String) in
      let safeStage = ["update_timeline", "widget_module_load"].contains(stage)
        ? stage
        : "unknown"
      self.logger.info(
        "event=publish_result source=app success=\(success, privacy: .public) stage=\(safeStage, privacy: .public)"
      )
    }

    Function("timelineRead") { (success: Bool, entryCount: Int, validEntryCount: Int) in
      self.logger.info(
        "event=timeline_read source=app success=\(success, privacy: .public) entry_count=\(entryCount, privacy: .public) valid_entry_count=\(validEntryCount, privacy: .public)"
      )
    }
  }
}
