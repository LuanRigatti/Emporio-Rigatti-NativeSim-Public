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
  @Guide(.anyOf(["client", "delivery", "financialMetric", "financialAnalysis", "factoryMetric", "routeMetric", "carMetric", "periodSummary", "clientField", "search", "clarification", "unsupportedDomain", "unsupportedMetric"]))
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

  @Guide(description: "Use exactly one allowed metric name, or empty only when the intent does not need a financial metric. Mapping: faturamento, faturei, receita, total vendido -> revenue; lucro or lucro líquido -> netProfit; em aberto, a receber, valor pendente -> receivable; baldes vendidos -> bucketsSold; entregas -> deliveryCount; lucro bruto -> grossProfit; recebido -> received; preço unitário do balde/preço do balde -> bucketPrice; custos totais -> totalCost; distância -> distanceKm; custo da fábrica -> factoryCost; lucro/margem/faturamento/custo por entrega or km -> the corresponding derived metric. Never return a calculated value.")
  @Guide(.anyOf(["", "bucketsSold", "deliveryCount", "revenue", "grossProfit", "netProfit", "received", "receivable", "bucketCost", "fuelCost", "otherCosts", "electricityCost", "averageDeliveryCost", "grossMargin", "netMargin", "salePerBucket", "profitPerBucket", "costPerBucket", "bucketPrice", "totalCost", "distanceKm", "factoryCost", "marginPercentage", "profitPerDelivery", "revenuePerDelivery", "costPerDelivery", "profitPerKm", "revenuePerKm", "costPerKm"]))
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

  @Guide(description: "For financialAnalysis only: choose max, min, compare, sum, average, rank, topN, percentageChange, ratio, trend, or report as appropriate, or empty when unused. Never calculate the result.")
  @Guide(.anyOf(["", "max", "min", "compare", "sum", "average", "rank", "topN", "percentageChange", "ratio", "trend", "report"]))
  let operation: String

  @Guide(description: "For financialAnalysis only: choose day, week, client, month, route, or factory for the grouping dimension, or empty when unused.")
  @Guide(.anyOf(["", "day", "week", "client", "month", "route", "factory"]))
  let groupBy: String

  @Guide(description: "For rank or topN, choose descending for largest values or ascending for smallest values. Use empty when unused.")
  @Guide(.anyOf(["", "ascending", "descending"]))
  let order: String

  @Guide(description: "For topN, the requested number of rows. Use a positive integer; use -1 when unused.")
  let limit: Int

  @Guide(description: "For ratio, the numerator metric. Use one allowed financial metric or empty when unused.")
  @Guide(.anyOf(["", "bucketsSold", "deliveryCount", "revenue", "grossProfit", "netProfit", "received", "receivable", "bucketCost", "fuelCost", "otherCosts", "electricityCost", "averageDeliveryCost", "grossMargin", "netMargin", "salePerBucket", "profitPerBucket", "costPerBucket", "bucketPrice", "totalCost", "distanceKm", "factoryCost", "marginPercentage", "profitPerDelivery", "revenuePerDelivery", "costPerDelivery", "profitPerKm", "revenuePerKm", "costPerKm"]))
  let numeratorMetric: String

  @Guide(description: "For ratio, the denominator metric. Use one allowed financial metric or empty when unused.")
  @Guide(.anyOf(["", "bucketsSold", "deliveryCount", "revenue", "grossProfit", "netProfit", "received", "receivable", "bucketCost", "fuelCost", "otherCosts", "electricityCost", "averageDeliveryCost", "grossMargin", "netMargin", "salePerBucket", "profitPerBucket", "costPerBucket", "bucketPrice", "totalCost", "distanceKm", "factoryCost", "marginPercentage", "profitPerDelivery", "revenuePerDelivery", "costPerDelivery", "profitPerKm", "revenuePerKm", "costPerKm"]))
  let denominatorMetric: String

  @Guide(description: "For compare, first calendar month number 1-12, or -1 when unused.")
  let comparisonStartMonth: Int

  @Guide(description: "For compare, first calendar year, or -1 when unused.")
  let comparisonStartYear: Int

  @Guide(description: "For compare, second calendar month number 1-12, or -1 when unused.")
  let comparisonEndMonth: Int

  @Guide(description: "For compare, second calendar year, or -1 when unused.")
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
        Interpret this Brazilian Portuguese Home Search query:
        \(query)

        Reference date (local calendar day): \(referenceDateISO)
        Return a structured intent only. Do not answer the user and do not calculate anything.

        Rules for this query:
        - Use the exact enum names from the schema, never translated labels.
        - If intent=financialMetric, fill financialMetric with the best matching allowed metric; do not leave it empty.
        - If the request asks for a greatest/smallest/ranked value or a comparison, use intent=financialAnalysis, fill operation, groupBy, and financialMetric. Use day for daily questions, client for customer rankings, and month for monthly rankings. Use deliveryCount for the number of deliveries. Interpret a customer being the best/one who bought the most as revenue grouped by client unless another metric is explicit. For the unit selling price of a customer's bucket, use bucketPrice grouped by client; this is different from bucketsSold, quantity, salePerBucket, and revenue. Do not return a calculated value.
        - For analytical operations, use sum for a total over a period, average for a mean, rank for a complete ordered ranking, topN for a limited ranking and fill limit, percentageChange for a change between two periods, ratio for a named numerator/denominator, trend for the direction of a real series, and report for a structured business summary. Use week when the request is weekly, route for route records, and factory for factory receipts only when that dimension is requested and supported. For rank/topN, use order=descending for "maior/melhor/mais" and order=ascending for "menor/pior/menos".
        - For derived metrics, use the exact metric name: marginPercentage=netProfit/revenue*100, profitPerDelivery=netProfit/deliveryCount, revenuePerDelivery=revenue/deliveryCount, costPerDelivery=totalCost/deliveryCount, profitPerKm=netProfit/distanceKm, revenuePerKm=revenue/distanceKm, and costPerKm=totalCost/distanceKm. The app performs all divisions and handles zero denominators.
        - For ratio, also fill numeratorMetric and denominatorMetric. For a request for an average of a derived quantity, use the derived metric directly with operation=average. For topN, use the explicit requested limit; never invent a limit when the request is not limited.
        - For a report or summary, use operation=report, groupBy=month unless another grouping is explicit, and use revenue as the default financialMetric when no single metric was requested. The app will assemble the report from real records.
        - For an ambiguous request such as an unqualified "melhor custo-benefício", use intent=clarification and do not choose a customer or metric. For a metric the app does not support, use intent=unsupportedMetric. For questions unrelated to Empório Rigatti records or capabilities, use intent=unsupportedDomain.
        - Do not force an unqualified request for the "best cost" into a client ranking: the app has several cost concepts and no single unambiguous client cost metric. Keep the intent ambiguous unless the user names a supported cost metric explicitly.
        - If a comparison does not name a metric, use revenue as the default financial metric; this is only the metric to aggregate from app data, never a value to calculate in the model.
        - For periodKind=year, "este ano" means the reference date's calendar year and "ano passado" means the immediately preceding calendar year.
        - If periodKind=month, fill both month and year. For "mês passado" or "mês anterior", calculate the previous calendar month from the reference date.
        - For a relative multi-month window such as "últimos 3 meses" or "últimos 6 meses", use periodKind=range with the first day of the earliest calendar month and the last day of the latest calendar month derived from the reference date. Use groupBy=month when the question asks for a monthly sum, average, or trend; do not invent a fixed number of rows.
        - For a quarter or another named calendar window, use periodKind=range with its real start and end dates and preserve the requested grouping dimension.
        - For a comparison or percentage change between two named months, use operation=compare or operation=percentageChange, groupBy=month, periodKind=range covering both months, fill startDate/endDate with the full range, and fill comparisonStartMonth/comparisonStartYear and comparisonEndMonth/comparisonEndYear.
        - Foundation Models only interprets the request. The app calculates all values after parsing.

        Examples:
        "Qual meu lucro no mes passado?" means intent=financialMetric, financialMetric=netProfit, periodKind=month, month/year equal to the calendar month immediately before the reference date.
        "Quanto eu lucrei em agosto?" means intent=financialMetric, financialMetric=netProfit, periodKind=month, month=8, year equal to the reference date's year.
        "Quanto faturei em agosto?" means intent=financialMetric, financialMetric=revenue, periodKind=month, month=8, year equal to the reference date's year.
        "Qual dia teve o maior faturamento em agosto?" means intent=financialAnalysis, financialMetric=revenue, operation=max, groupBy=day, periodKind=month, month=8, year equal to the reference date's year.
        "Qual foi o dia que menos vendi em agosto?" means intent=financialAnalysis, financialMetric=revenue, operation=min, groupBy=day, periodKind=month, month=8, year equal to the reference date's year.
        "Em qual dia tive mais entregas?" means intent=financialAnalysis, financialMetric=deliveryCount, operation=max, groupBy=day, periodKind=month, month/year equal to the requested month.
        "Qual cliente mais comprou em agosto?" means intent=financialAnalysis, financialMetric=revenue, operation=max, groupBy=client, periodKind=month, month=8, year equal to the reference date's year.
        "Qual foi o melhor cliente que eu vendi no mês passado?" means intent=financialAnalysis, financialMetric=revenue, operation=max, groupBy=client, periodKind=month, month/year equal to the previous calendar month from the reference date.
        "Qual cliente tem o balde mais caro?" means intent=financialAnalysis, financialMetric=bucketPrice, operation=max, groupBy=client, periodKind=none. Use the current unit price stored for each client; never use delivery quantity or revenue.
        "Qual o balde mais caro e de qual cliente?" has the same bucketPrice/client analysis intent.
        "Qual mês teve maior lucro este ano?" means intent=financialAnalysis, financialMetric=netProfit, operation=max, groupBy=month, periodKind=year, year equal to the reference date's year.
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
      Use only the allowed values from the structured schema. For intent=financialMetric, financialMetric must never be empty: use revenue for faturamento/faturei/receita/total vendido, netProfit for lucro/lucro líquido, receivable for em aberto/a receber/valor pendente, bucketsSold for baldes vendidos, deliveryCount for entregas, grossProfit for lucro bruto, received for recebido, and bucketPrice only for an explicit analytical ranking of current customer bucket prices.
      For an explicit request about unpaid amounts, also set paymentStatus=open when applicable. Use empty strings, -1, or false only when a field is unused.
      For analytical requests, set intent=financialAnalysis, choose the operation and grouping that match the request, and set financialMetric to the requested metric. Interpret "mais"/"maior"/"melhor" as max and "menos"/"menor"/"pior" as min. A customer ranking about who bought or sold the most uses revenue grouped by client. An explicit current bucket unit-price ranking uses bucketPrice grouped by client and periodKind=none. Use the generic operation and dimension rules from the schema for sum, average, rank, topN, percentageChange, ratio, trend, and report. For rank/topN, set order=descending for largest values and order=ascending for smallest values. Do not calculate the result. For a comparison between two named months, set operation=compare, groupBy=month, use a range covering both months, and fill the four comparison month/year fields.
      For relative multi-month windows such as "últimos 3 meses" or "últimos 6 meses", use a range from the first day of the earliest month through the last day of the latest month derived from the supplied reference date; use groupBy=month for monthly sums, averages, or trends. Use the real dates for quarters and other calendar windows.
      Do not force an unqualified "best cost" question into a client result because the app's cost metrics are not one unambiguous client-scoped measure.
      If a comparison does not name a metric, use revenue as the default financial metric. The app, not the model, calculates the compared values.
      For periodKind=month, always fill both month and year with the requested calendar month. Never return month=-1 or year=-1 for a monthly period.
      Resolve relative periods from the supplied reference date: hoje is that date, ontem is one day before, mês atual is its month, mês passado/mês anterior is the immediately preceding calendar month, and este ano/ano passado are the reference/current and preceding calendar years. Include crossing a year boundary for relative months. A named month without a year uses the reference date's year, following the app's existing search semantics.
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
