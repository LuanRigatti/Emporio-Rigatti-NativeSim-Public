import ExpoModulesCore
import Foundation

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

    AsyncFunction("interpret") { (query: String, referenceDateISO: String) async throws -> String? in
      guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
      return try await Self.interpret(query: query, referenceDateISO: referenceDateISO)
    }
  }
}

private extension NativeAppleIntelligenceModule {
  static var foundationModelsAvailable: Bool {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      return SystemLanguageModel.default.isAvailable
    }
#endif
    return false
  }

  static func interpret(query: String, referenceDateISO: String) async throws -> String? {
#if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      guard SystemLanguageModel.default.isAvailable else { return nil }

      let session = LanguageModelSession(instructions: """
        You interpret Portuguese search text for a business app. Return only the structured intent fields.
        You receive no business records and must never invent, retrieve, calculate, or return financial values.
        Never return totals, prices, balances, percentages, revenue, profit, or any other computed result.
        Use only the allowed existing enum names described by each field. Use empty strings, -1, or false when unused.
        Keep confidence below 0.75 whenever the request is ambiguous or an enum is uncertain.
        The reference date is supplied so relative dates can be resolved, but it is not app data.
        """)

      let prompt = """
        Interpret this Portuguese Home Search query:
        \(query)

        Reference date: \(referenceDateISO)
        Return a structured intent only. Do not answer the user and do not calculate anything.
        """
      let response = try await session.respond(to: prompt, generating: NativeAppleSearchIntentPayload.self)
      return try encode(response.content)
    }
#endif
    return nil
  }

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
