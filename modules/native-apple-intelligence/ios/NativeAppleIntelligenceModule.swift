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

  @Guide(.anyOf(["", "day", "week", "client", "month", "route", "factory"]))
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

  let comparisonStartMonth: Int

  let comparisonStartYear: Int

  let comparisonEndMonth: Int

  let comparisonEndYear: Int
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
        Convert this Brazilian Portuguese business-search query to the structured schema.
        Query: \(query)
        Reference date: \(referenceDateISO)
        Return only structured fields. Never answer, use records, or calculate values.
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
      } catch LanguageModelError.contextSizeExceeded(let context) {
        logger.error("generation error kind=contextOverflow contextSize=\(context.contextSize, privacy: .public) tokenCount=\(context.tokenCount, privacy: .public)")
        throw LanguageModelError.contextSizeExceeded(context)
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
      Parse Brazilian Portuguese queries for Empório Rigatti's local business data.
      Return only structured fields. You receive no records and never answer or calculate.
      Use empty strings, -1, or false for unused fields and exact schema enum values.
      Map faturamento/receita/vendido to revenue; lucro líquido to netProfit; em aberto/a receber to receivable; baldes to bucketsSold; entregas to deliveryCount; recebido to received; preço unitário do balde to bucketPrice; custos totais to totalCost; distância to distanceKm; custo da fábrica to factoryCost.
      For analysis use financialAnalysis. max/min mean greatest/smallest; sum/average aggregate; rank/topN order results; compare/percentageChange compare periods; ratio uses numeratorMetric and denominatorMetric; trend classifies a series; report creates a structured summary. Use groupBy day, week, client, month, route, or factory as requested.
      "melhor/mais comprou/vendeu" for a client means max revenue by client unless another metric is explicit. An explicit bucket-price question means max bucketPrice by client with no period. For rank/topN use order descending for greatest and ascending for smallest; set limit only for topN.
      Derived metric names are marginPercentage, profitPerDelivery, revenuePerDelivery, costPerDelivery, profitPerKm, revenuePerKm, and costPerKm. The app performs all arithmetic.
      A report defaults to groupBy=month and revenue. An unqualified cost-benefit question is clarification; unsupported app metrics are unsupportedMetric; unrelated questions are unsupportedDomain.
      Resolve hoje, ontem, mês atual, mês passado, este ano, ano passado, ranges, and named calendar periods from the reference date. For month periods fill month and year; for comparisons fill both comparison month/year pairs.
      Keep confidence below 0.6 when the request is ambiguous.
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
      "operation": payload.operation,
      "groupBy": payload.groupBy,
      "order": payload.order,
      "limit": payload.limit,
      "numeratorMetric": payload.numeratorMetric,
      "denominatorMetric": payload.denominatorMetric,
      "comparisonStartMonth": payload.comparisonStartMonth,
      "comparisonStartYear": payload.comparisonStartYear,
      "comparisonEndMonth": payload.comparisonEndMonth,
      "comparisonEndYear": payload.comparisonEndYear,
    ]
  }
#endif
}
