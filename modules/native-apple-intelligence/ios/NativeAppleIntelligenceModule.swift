import ExpoModulesCore
import Foundation
import os

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26.0, *)
@Generable(description: "Structured Portuguese search intent. Unused strings are empty; unused numbers are -1.")
private struct NativeAppleSearchIntentPayload {
  let confidence: Double

  @Guide(.anyOf(["client", "delivery", "financialMetric", "financialAnalysis", "factoryMetric", "routeMetric", "carMetric", "periodSummary", "clientField", "search", "clarification", "unsupportedDomain", "unsupportedMetric"]))
  let intent: String

  let text: String

  @Guide(.anyOf(["none", "date", "dayMonth", "month", "year", "range"]))
  let periodKind: String

  @Guide(description: "Relative span unit; empty when unused.")
  @Guide(.anyOf(["", "day", "week", "month", "year"]))
  let periodSpanUnit: String

  @Guide(description: "Relative span direction; empty when unused.")
  @Guide(.anyOf(["", "last", "current", "previous", "next", "toDate"]))
  let periodSpanDirection: String

  @Guide(description: "Positive relative span count; -1 when unused.")
  let periodSpanCount: Int

  let date: String

  let startDate: String

  let endDate: String

  let day: Int

  let month: Int

  let year: Int

  let quantity: Int

  let money: Double

  @Guide(.anyOf(["", "paid", "open"]))
  let paymentStatus: String

  @Guide(.anyOf(["", "invoice", "boleto"]))
  let documentType: String

  @Guide(.anyOf(["", "bucketsSold", "deliveryCount", "revenue", "grossProfit", "netProfit", "received", "receivable", "bucketCost", "fuelCost", "otherCosts", "electricityCost", "averageDeliveryCost", "grossMargin", "netMargin", "salePerBucket", "profitPerBucket", "costPerBucket", "bucketPrice", "totalCost", "distanceKm", "factoryCost", "marginPercentage", "profitPerDelivery", "revenuePerDelivery", "costPerDelivery", "profitPerKm", "revenuePerKm", "costPerKm"]))
  let financialMetric: String

  @Guide(.anyOf(["", "currentPrice", "address", "usesInvoice", "usesBoleto"]))
  let clientField: String

  @Guide(.anyOf(["", "purchases", "bucketsPurchased", "purchaseValue", "payments", "paidValue", "openValue"]))
  let factoryMetric: String

  @Guide(.anyOf(["", "paid", "partial", "open", "outstanding"]))
  let factoryStatus: String

  let factoryPaymentDateUnsupported: Bool

  @Guide(.anyOf(["", "distance", "routes"]))
  let routeMetric: String

  @Guide(.anyOf(["", "gasolineAutonomy", "alcoholAutonomy", "consumption"]))
  let carMetric: String

  let periodSummary: Bool

  @Guide(.anyOf(["", "max", "min", "compare", "sum", "average", "rank", "topN", "percentageChange", "ratio", "trend", "report"]))
  let operation: String

  @Guide(.anyOf(["", "day", "week", "year", "client", "month", "route", "factory"]))
  let groupBy: String

  @Guide(description: "Order for ranking; empty when unused.")
  @Guide(.anyOf(["", "ascending", "descending"]))
  let order: String

  @Guide(description: "Positive topN count; -1 when unused.")
  let limit: Int

  @Guide(description: "Numerator metric for ratio; empty when unused.")
  let numeratorMetric: String

  @Guide(description: "Denominator metric for ratio; empty when unused.")
  let denominatorMetric: String

  @Guide(description: "Optional second metric using the same values as financialMetric; empty when unused.")
  let secondaryMetric: String

  let comparisonStartMonth: Int

  let comparisonStartYear: Int

  let comparisonEndMonth: Int

  let comparisonEndYear: Int

  let comparisonInitialStartDate: String

  let comparisonInitialEndDate: String

  let comparisonFinalStartDate: String

  let comparisonFinalEndDate: String
}
#endif

public final class NativeAppleIntelligenceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeAppleIntelligence")

    Constant("isAvailable") {
      Self.foundationModelsAvailable
    }
    Constant("availability") {
      Self.foundationModelsAvailability
    }
    Constant("localeIdentifier") {
      Locale.current.identifier
    }
    Constant("supportsLocale") {
      Self.foundationModelsSupportsCurrentLocale
    }

    AsyncFunction("interpret") { (query: String, referenceDateISO: String) async throws -> [String: Any]? in
      guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
      return try await Self.interpret(query: query, referenceDateISO: referenceDateISO)
    }
    AsyncFunction("prewarm") { () async -> Void in
      Self.prewarm()
    }
  }
}

private extension NativeAppleIntelligenceModule {
  static let logger = Logger(subsystem: "NativeAppleIntelligence", category: "Search")

  static var foundationModelsAvailable: Bool {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      return SystemLanguageModel.default.isAvailable
    }
#endif
    return false
  }

  static var foundationModelsAvailability: String {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      return availabilityDescription(for: SystemLanguageModel.default)
    }
#endif
    return "unsupportedOS"
  }

  static var foundationModelsSupportsCurrentLocale: Bool {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      return SystemLanguageModel.default.supportsLocale(Locale.current)
    }
#endif
    return false
  }

  static func interpret(query: String, referenceDateISO: String) async throws -> [String: Any]? {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      let model = SystemLanguageModel.default
      let currentLocale = Locale.current
      let currentLocaleSupported = model.supportsLocale(currentLocale)
      let brazilianPortugueseSupported = model.supportsLocale(Locale(identifier: "pt_BR"))
      logger.info("model.isAvailable=\(model.isAvailable, privacy: .public) availability=\(Self.availabilityDescription(for: model), privacy: .public) locale=\(currentLocale.identifier, privacy: .public) supportsCurrentLocale=\(currentLocaleSupported, privacy: .public) supportsPtBR=\(brazilianPortugueseSupported, privacy: .public)")

      guard model.isAvailable else {
        logger.info("fallback: model unavailable (\(Self.availabilityDescription(for: model), privacy: .public))")
        return nil
      }
      guard brazilianPortugueseSupported else {
        logger.info("fallback: unsupportedLanguageOrLocale for pt_BR")
        return nil
      }

      let session = makeSession()
      let startedAt = Date()
      logger.info("query received length=\(query.count, privacy: .public) session=created referenceDate=\(referenceDateISO, privacy: .public)")

      let prompt = """
        Convert this Brazilian Portuguese business-search query to a compact structured plan.
        Query: \(query)
        Reference date: \(referenceDateISO)
        Return only plan fields. Never answer, access records, or calculate values.
        Use exact enum values; use empty strings, -1, or false when unused.
      """
      logger.info("generation started")
      do {
        let response = try await session.respond(
          to: prompt,
          generating: NativeAppleSearchIntentPayload.self,
          includeSchemaInPrompt: true
        )
        let encoded = encode(response.content)
        logger.info("generation finished durationMs=\(Int(Date().timeIntervalSince(startedAt) * 1000), privacy: .public) structuredResponse=received")
        return encoded
      } catch LanguageModelSession.GenerationError.exceededContextWindowSize(let context) {
        logger.error("generation error kind=contextOverflow context=\(context.debugDescription, privacy: .public)")
        throw LanguageModelSession.GenerationError.exceededContextWindowSize(context)
      } catch {
        logger.error("generation error durationMs=\(Int(Date().timeIntervalSince(startedAt) * 1000), privacy: .public) error=\(String(describing: error), privacy: .public)")
        throw error
      }
    }
#endif
    return nil
  }

  static func prewarm() {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      let model = SystemLanguageModel.default
      guard model.isAvailable else {
        logger.info("prewarm skipped: model unavailable (\(Self.availabilityDescription(for: model), privacy: .public))")
        return
      }
      guard model.supportsLocale(Locale(identifier: "pt_BR")) else {
        logger.info("prewarm skipped: unsupportedLanguageOrLocale for pt_BR")
        return
      }
      let session = makeSession()
      session.prewarm()
      logger.info("prewarm requested")
    }
#endif
  }

#if canImport(FoundationModels)
  @available(iOS 26.0, *)
  static func makeSession() -> LanguageModelSession {
    logger.info("session created")
    return LanguageModelSession(instructions: """
      Parse Brazilian Portuguese queries for Empório Rigatti's local business data. The output is an interpretation plan only; the app owns every number.
      For scalar requests use financialMetric, factoryMetric, routeMetric, carMetric, or periodSummary. For analysis use intent=financialAnalysis, financialMetric, operation, and groupBy. metric is what is measured; groupBy is how records are grouped and is never the time period.
      Map revenue/faturamento/receita to revenue; lucro bruto/netProfit to grossProfit/netProfit; a receber/em aberto to receivable; recebido to received; baldes vendidos to bucketsSold; entregas to deliveryCount; custo dos baldes to bucketCost; combustível to fuelCost; luz to electricityCost; outros custos to otherCosts; custo total to totalCost; margem and per-delivery/per-bucket/per-km language to the matching derived metric; unit bucket price to bucketPrice; distance/km to distanceKm; factory purchase cost to factoryCost. Use only metrics backed by app data.
      Supported operations are max, min, sum, average, rank, topN, compare, percentageChange, ratio, trend, and report. Greatest/smallest language maps to max/min; rankings use rank/topN with order and limit. Use numeratorMetric and denominatorMetric for ratio and secondaryMetric for a second value in the same groups. The app performs all arithmetic and sorting.
      Supported groupBy values are day, week, month, year, client, route, and factory. Filters are paymentStatus, documentType, and factoryStatus; keep them separate from metric and period.
      Resolve explicit and relative periods from the supplied reference date. For last/current/previous/next/toDate spans use periodSpanUnit, periodSpanDirection, and positive periodSpanCount; the app resolves calendar dates. For comparison use the comparison month/year fields or the four ISO date fields.
      Use clarification for missing or conflicting plan fields, including ambiguous cost-benefit requests; unsupportedMetric for unavailable app data; unsupportedDomain for unrelated questions. Never turn an analytical request into a scalar metric. Keep confidence below 0.6 when ambiguous.
      """)
  }

  @available(iOS 26.0, *)
  static func availabilityDescription(for model: SystemLanguageModel) -> String {
    switch model.availability {
    case .available:
      return "available"
    case .unavailable(let reason):
      switch reason {
      case .appleIntelligenceNotEnabled:
        return "appleIntelligenceNotEnabled"
      case .deviceNotEligible:
        return "deviceNotEligible"
      case .modelNotReady:
        return "modelNotReady"
      @unknown default:
        return "unavailable"
      }
    }
  }
#endif

#if canImport(FoundationModels)
  @available(iOS 26.0, *)
  static func encode(_ payload: NativeAppleSearchIntentPayload) -> [String: Any] {
    return [
      "confidence": payload.confidence,
      "intent": payload.intent,
      "text": payload.text,
      "periodKind": payload.periodKind,
      "date": payload.date,
      "startDate": payload.startDate,
      "endDate": payload.endDate,
      "day": payload.day,
      "month": payload.month,
      "year": payload.year,
      "quantity": payload.quantity,
      "money": payload.money,
      "paymentStatus": payload.paymentStatus,
      "documentType": payload.documentType,
      "financialMetric": payload.financialMetric,
      "clientField": payload.clientField,
      "factoryMetric": payload.factoryMetric,
      "factoryStatus": payload.factoryStatus,
      "factoryPaymentDateUnsupported": payload.factoryPaymentDateUnsupported,
      "routeMetric": payload.routeMetric,
      "carMetric": payload.carMetric,
      "periodSummary": payload.periodSummary,
      "periodSpanUnit": payload.periodSpanUnit,
      "periodSpanDirection": payload.periodSpanDirection,
      "periodSpanCount": payload.periodSpanCount,
      "operation": payload.operation,
      "groupBy": payload.groupBy,
      "order": payload.order,
      "limit": payload.limit,
      "numeratorMetric": payload.numeratorMetric,
      "denominatorMetric": payload.denominatorMetric,
      "secondaryMetric": payload.secondaryMetric,
      "comparisonStartMonth": payload.comparisonStartMonth,
      "comparisonStartYear": payload.comparisonStartYear,
      "comparisonEndMonth": payload.comparisonEndMonth,
      "comparisonEndYear": payload.comparisonEndYear,
      "comparisonInitialStartDate": payload.comparisonInitialStartDate,
      "comparisonInitialEndDate": payload.comparisonInitialEndDate,
      "comparisonFinalStartDate": payload.comparisonFinalStartDate,
      "comparisonFinalEndDate": payload.comparisonFinalEndDate,
    ]
  }
#endif
}
