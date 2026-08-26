import ExpoModulesCore
import Foundation
import os

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26.0, *)
@Generable
private struct NativeAppleSearchIntentPayload {
  @Guide(description: "Confidence from 0 to 1. Use a value below 0.75 when the query is ambiguous.")
  let confidence: Double

  @Guide(description: "One of: client, delivery, financialMetric, factoryMetric, routeMetric, carMetric, periodSummary, clientField, search.")
  let intent: String

  @Guide(description: "Only the client or entity text to search for. Empty when there is no entity text.")
  let text: String

  @Guide(description: "One of: none, date, dayMonth, month, year, range.")
  let periodKind: String

  @Guide(description: "ISO date YYYY-MM-DD, or empty when unused.")
  let date: String

  @Guide(description: "ISO start date YYYY-MM-DD, or empty when unused.")
  let startDate: String

  @Guide(description: "ISO end date YYYY-MM-DD, or empty when unused.")
  let endDate: String

  @Guide(description: "Day number 1-31, or -1 when unused.")
  let day: Int

  @Guide(description: "Month number 1-12, or -1 when unused.")
  let month: Int

  @Guide(description: "Four digit year, or -1 when unused.")
  let year: Int

  @Guide(description: "Bucket quantity, or -1 when unused. Never calculate it.")
  let quantity: Int

  @Guide(description: "Money amount explicitly written by the user, or -1 when unused. Never calculate it.")
  let money: Double

  @Guide(description: "One of: paid, open, or empty.")
  let paymentStatus: String

  @Guide(description: "One of: invoice, boleto, or empty.")
  let documentType: String

  @Guide(description: "One existing financial metric name, or empty. Never return a value.")
  let financialMetric: String

  @Guide(description: "Existing client field name, or empty.")
  let clientField: String

  @Guide(description: "One existing factory metric name, or empty.")
  let factoryMetric: String

  @Guide(description: "One of: paid, partial, open, outstanding, or empty.")
  let factoryStatus: String

  @Guide(description: "True only when the query asks for factory payment dates, which the existing search marks as unsupported.")
  let factoryPaymentDateUnsupported: Bool

  @Guide(description: "One existing route metric name, or empty.")
  let routeMetric: String

  @Guide(description: "One existing car metric name, or empty.")
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

    AsyncFunction("interpret") { (query: String, referenceDateISO: String) async throws -> String? in
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

  static func interpret(query: String, referenceDateISO: String) async throws -> String? {
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

        Examples:
        "Quanto eu lucrei em agosto?" means financialMetric=netProfit and periodKind=month.
        "Quanto sobrou pra mim em agosto?" means financialMetric=netProfit and periodKind=month.
        "Quantos baldes vendi anteontem?" means financialMetric=bucketsSold and periodKind=date, using the local calendar day two days before the reference date.
        """
      logger.info("generation started")
      do {
        let response = try await session.respond(
          to: prompt,
          generating: NativeAppleSearchIntentPayload.self,
          includeSchemaInPrompt: true
        )
        let encoded = try encode(response.content)
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
      Use only the allowed existing enum names described by each field. Use empty strings, -1, or false when unused.
      Keep confidence below 0.75 whenever the request is ambiguous or an enum is uncertain.
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
  static func encode(_ payload: NativeAppleSearchIntentPayload) throws -> String {
    let object: [String: Any] = [
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
    let data = try JSONSerialization.data(withJSONObject: object)
    guard let json = String(data: data, encoding: .utf8) else {
      throw NSError(domain: "NativeAppleIntelligence", code: 1)
    }
    return json
  }
#endif
}
