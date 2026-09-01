import ExpoModulesCore
import Foundation
import os

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26.0, *)
@Generable
private struct NativeAppleSearchIntentPayload {
  @Guide(description: "Confidence from 0 to 1. Use a value below 0.6 when the query is ambiguous.")
  let confidence: Double

  @Guide(description: "The intent kind. Use exactly one of the allowed values.")
  @Guide(.anyOf(["client", "delivery", "financialMetric", "factoryMetric", "routeMetric", "carMetric", "periodSummary", "clientField", "search"]))
  let intent: String

  @Guide(description: "Only the client or entity text to search for. Empty when there is no entity text.")
  let text: String

  @Guide(description: "The period kind. Use date for today/yesterday/tomorrow, month for the current/previous/named calendar month, year for a calendar year, range for an explicit date range, and none when no period is requested.")
  @Guide(.anyOf(["none", "date", "dayMonth", "month", "year", "range"]))
  let periodKind: String

  @Guide(description: "ISO date YYYY-MM-DD, or empty when unused.")
  let date: String

  @Guide(description: "ISO start date YYYY-MM-DD, or empty when unused.")
  let startDate: String

  @Guide(description: "ISO end date YYYY-MM-DD, or empty when unused.")
  let endDate: String

  @Guide(description: "Day number 1-31, or -1 when unused.")
  let day: Int

  @Guide(description: "Month number 1-12. Required when periodKind is month; use -1 only when the period does not use a month.")
  let month: Int

  @Guide(description: "Four digit calendar year. Required when periodKind is month; use -1 only when the period does not use a year.")
  let year: Int

  @Guide(description: "Bucket quantity, or -1 when unused. Never calculate it.")
  let quantity: Int

  @Guide(description: "Money amount explicitly written by the user, or -1 when unused. Never calculate it.")
  let money: Double

  @Guide(description: "Use open for unpaid/pending customer deliveries when the query asks what is still open; use paid for paid deliveries; use empty when not requested.")
  @Guide(.anyOf(["", "paid", "open"]))
  let paymentStatus: String

  @Guide(description: "Use exactly invoice, boleto, or empty when no document type is requested.")
  @Guide(.anyOf(["", "invoice", "boleto"]))
  let documentType: String

  @Guide(description: "Use exactly one allowed metric name, or empty only when the intent is not financialMetric. Mapping: faturamento, faturei, receita, total vendido -> revenue; lucro or lucro líquido -> netProfit; em aberto, a receber, valor pendente -> receivable; baldes vendidos -> bucketsSold; lucro bruto -> grossProfit; recebido -> received; and use the remaining existing metric names for their matching concepts. Never return a calculated value.")
  @Guide(.anyOf(["", "bucketsSold", "revenue", "grossProfit", "netProfit", "received", "receivable", "bucketCost", "fuelCost", "otherCosts", "electricityCost", "averageDeliveryCost", "grossMargin", "netMargin", "salePerBucket", "profitPerBucket", "costPerBucket"]))
  let financialMetric: String

  @Guide(description: "Use exactly one existing client field name or empty.")
  @Guide(.anyOf(["", "currentPrice", "address", "usesInvoice", "usesBoleto"]))
  let clientField: String

  @Guide(description: "Use exactly one existing factory metric name or empty.")
  @Guide(.anyOf(["", "purchases", "bucketsPurchased", "purchaseValue", "payments", "paidValue", "openValue"]))
  let factoryMetric: String

  @Guide(description: "Use exactly one factory payment status or empty.")
  @Guide(.anyOf(["", "paid", "partial", "open", "outstanding"]))
  let factoryStatus: String

  @Guide(description: "True only when the query asks for factory payment dates, which the existing search marks as unsupported.")
  let factoryPaymentDateUnsupported: Bool

  @Guide(description: "Use exactly one existing route metric name or empty.")
  @Guide(.anyOf(["", "distance", "routes"]))
  let routeMetric: String

  @Guide(description: "Use exactly one existing car metric name or empty.")
  @Guide(.anyOf(["", "gasolineAutonomy", "alcoholAutonomy", "consumption"]))
  let carMetric: String

  @Guide(description: "True only for a request for a period summary.")
  let periodSummary: Bool
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
        Interpret this Brazilian Portuguese Home Search query:
        \(query)

        Reference date (local calendar day): \(referenceDateISO)
        Return a structured intent only. Do not answer the user and do not calculate anything.

        Rules for this query:
        - Use the exact enum names from the schema, never translated labels.
        - If intent=financialMetric, fill financialMetric with the best matching allowed metric; do not leave it empty.
        - If periodKind=month, fill both month and year. For "mês passado" or "mês anterior", calculate the previous calendar month from the reference date.
        - Foundation Models only interprets the request. The app calculates all values after parsing.

        Examples:
        "Qual meu lucro no mes passado?" means intent=financialMetric, financialMetric=netProfit, periodKind=month, month/year equal to the calendar month immediately before the reference date.
        "Quanto eu lucrei em agosto?" means intent=financialMetric, financialMetric=netProfit, periodKind=month, month=8, year equal to the reference date's year.
        "Quanto faturei em agosto?" means intent=financialMetric, financialMetric=revenue, periodKind=month, month=8, year equal to the reference date's year.
        "Quanto tenho em aberto?" means intent=financialMetric, financialMetric=receivable, paymentStatus=open, periodKind=none.
        "Quantas entregas fiz hoje?" means intent=delivery, periodKind=date, date equal to the reference date.
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
      The person's locale is pt_BR.
      The user input is in Brazilian Portuguese (pt-BR).
      You interpret Portuguese search text for a business app. Return only the structured intent fields.
      You receive no business records and must never invent, retrieve, calculate, or return financial values.
      Never return totals, prices, balances, percentages, revenue, profit, or any other computed result.
      Use only the allowed values from the structured schema. For intent=financialMetric, financialMetric must never be empty: use revenue for faturamento/faturei/receita/total vendido, netProfit for lucro/lucro líquido, receivable for em aberto/a receber/valor pendente, bucketsSold for baldes vendidos, grossProfit for lucro bruto, and received for recebido.
      For an explicit request about unpaid amounts, also set paymentStatus=open when applicable. Use empty strings, -1, or false only when a field is unused.
      For periodKind=month, always fill both month and year with the requested calendar month. Never return month=-1 or year=-1 for a monthly period.
      Resolve relative periods from the supplied reference date: hoje is that date, ontem is one day before, mês atual is its month, and mês passado/mês anterior is the immediately preceding calendar month, including crossing a year boundary. A named month without a year uses the reference date's year, following the app's existing search semantics.
      Keep confidence below 0.6 whenever the request is ambiguous or an enum is uncertain.
      The reference date is supplied as a local calendar date so relative dates can be resolved.
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
    ]
  }
#endif
}
