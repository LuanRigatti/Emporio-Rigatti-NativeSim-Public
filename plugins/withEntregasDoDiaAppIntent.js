const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
const plist = require('@expo/plist').default;

const EXPECTED_EXPO_WIDGETS_VERSION = '58.0.19';
const EXTENSION_TARGET = 'ExpoWidgetsTarget';
const ACTIONS_URL_INFO_KEY = 'RigattiDeliveryWidgetActionsURL';
const KEYCHAIN_ACCESS_GROUP_INFO_KEY = 'RigattiDeliveryWidgetKeychainAccessGroup';
const DELIVERY_ACTION_MARKER = '// RIGATTI_DELIVERY_WIDGET_ACTIONS_V1';
const WIDGET_BUTTON_MARKER = '// RIGATTI_DELIVERY_WIDGET_BUTTON_V1';
const WIDGET_MODULE_MARKER = '// RIGATTI_DELIVERY_WIDGET_MODULE_V1';
const WIDGET_ENVIRONMENT_MARKER = '// RIGATTI_DELIVERY_WIDGET_ENVIRONMENT_V1';
const WIDGET_OBJECT_LOCK_MARKER = '// RIGATTI_DELIVERY_WIDGET_OBJECT_LOCK_V1';

const DELIVERY_ACTION_SWIFT = String.raw`// RIGATTI_DELIVERY_WIDGET_ACTIONS_V1
import AppIntents
import Darwin
import Foundation
import os
import Security
import WidgetKit

private enum RigattiDeliveryCompletionDiagnostics {
  private static let logger = os.Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",
    category: "DeliveryCompletion"
  )

  static func event(_ name: String) {
    logger.info("event=\(name, privacy: .public)")
  }

  static func httpResponse(_ statusCode: Int) {
    logger.info("event=http_response status_code=\(statusCode, privacy: .public)")
  }
}

private struct RigattiDeliveryWidgetCredential: Codable {
  let sessionId: String
  let uid: String
  let sessionVersion: Int
  let capability: String
  var expiresAt: Double
  let absoluteExpiresAt: Double
}

private struct RigattiDeliveryWidgetAppSession: Codable {
  let uid: String?
  let sessionVersion: Int
}

private enum RigattiDeliveryWidgetActionError: Error {
  case unavailable
  case unauthorized
  case invalidSnapshot
  case staleCredential
  case storageFailure
}

enum RigattiDeliveryWidgetKeychain {
  private static let service = "com.pareact.delivery-widget-actions"
  private static let activeAccount = "active-authorization"
  private static let appSessionAccount = "active-app-session"
  private static let pendingRevocationsAccount = "pending-revocations"
  private static let receiptSessionsAccount = "receipt-sessions"
  private static let actionRevisionsAccount = "action-revisions"
  private static let receiptPrefix = "__rigatti_delivery_action_receipt_"
  private static let timelineLockName = "rigatti-delivery-widget-actions.lock"

  static func withTimelineMutationLock<T>(_ operation: () throws -> T) throws -> T {
    guard let groupIdentifier = WidgetsStorage.appGroupIdentifier,
          let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier) else {
      throw RigattiDeliveryWidgetActionError.storageFailure
    }
    let lockURL = container.appendingPathComponent(timelineLockName, isDirectory: false)
    let descriptor = lockURL.path.withCString { open($0, O_CREAT | O_RDWR, 0o600) }
    guard descriptor >= 0 else { throw RigattiDeliveryWidgetActionError.storageFailure }
    defer { _ = close(descriptor) }
    while flock(descriptor, LOCK_EX) != 0 {
      if errno == EINTR { continue }
      throw RigattiDeliveryWidgetActionError.storageFailure
    }
    defer { _ = flock(descriptor, LOCK_UN) }
    return try operation()
  }

  static func shouldAcceptAppTimeline(_ entries: [[String: Any]]) -> Bool {
    for entry in entries {
      guard let props = entry["props"] as? [String: Any],
            let date = props["date"] as? String,
            let sessionId = props["actionSessionId"] as? String else { continue }
      guard let active = readCredential(), isCurrentAppSession(active), active.sessionId == sessionId else { return false }
      if hasPendingReceipt(sessionId: sessionId, date: date) { return false }
      let incomingRevision = (props["actionRevision"] as? NSNumber)?.intValue ?? -1
      if incomingRevision < actionRevision(sessionId: sessionId, date: date) { return false }
    }
    return true
  }

  private static func hasPendingReceipt(sessionId: String, date: String) -> Bool {
    guard let defaults = defaults() else { return false }
    return defaults.dictionaryRepresentation().contains { entry in
      let (key, value) = entry
      guard key.hasPrefix(receiptPrefix),
            let receipt = value as? [String: Any] else { return false }
      return receipt["sessionId"] as? String == sessionId && receipt["date"] as? String == date
    }
  }

  private static func sharedKeychainAccessGroup() -> String? {
    guard let value = Bundle.main.object(forInfoDictionaryKey: "RigattiDeliveryWidgetKeychainAccessGroup") as? String,
          !value.isEmpty,
          !value.contains("$(") else { return nil }
    return value
  }

  private static func query(account: String) -> [String: Any]? {
    guard let accessGroup = sharedKeychainAccessGroup() else { return nil }
    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrAccessGroup as String: accessGroup,
    ]
  }

  private static func readData(account: String) -> Data? {
    guard var request = query(account: account) else { return nil }
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess else { return nil }
    return result as? Data
  }

  private static func writeData(_ data: Data, account: String) throws {
    guard let itemQuery = query(account: account) else {
      throw RigattiDeliveryWidgetActionError.storageFailure
    }
    let updateStatus = SecItemUpdate(
      itemQuery as CFDictionary,
      [kSecValueData as String: data] as CFDictionary
    )
    if updateStatus == errSecSuccess { return }
    guard updateStatus == errSecItemNotFound else { throw RigattiDeliveryWidgetActionError.storageFailure }

    var attributes = itemQuery
    attributes[kSecValueData as String] = data
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else {
      throw RigattiDeliveryWidgetActionError.storageFailure
    }
  }

  @discardableResult
  private static func deleteData(account: String) -> Bool {
    guard let itemQuery = query(account: account) else { return false }
    let status = SecItemDelete(itemQuery as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
  }

  private static func readCredential() -> RigattiDeliveryWidgetCredential? {
    guard let data = readData(account: activeAccount) else { return nil }
    return try? JSONDecoder().decode(RigattiDeliveryWidgetCredential.self, from: data)
  }

  private static func readAppSession() -> RigattiDeliveryWidgetAppSession? {
    guard let data = readData(account: appSessionAccount) else { return nil }
    return try? JSONDecoder().decode(RigattiDeliveryWidgetAppSession.self, from: data)
  }

  private static func isCurrentAppSession(_ credential: RigattiDeliveryWidgetCredential) -> Bool {
    guard let session = readAppSession() else { return false }
    return session.uid == credential.uid && session.sessionVersion == credential.sessionVersion
  }

  static func prepareAppSession(uid: String?, sessionVersion: Int) -> Bool {
    guard sessionVersion >= 0 else { return false }
    do {
      try withTimelineMutationLock {
        let currentSession = readAppSession()
        let currentCredential = readCredential()
        if currentSession?.uid == uid && currentSession?.sessionVersion == sessionVersion &&
            (currentCredential == nil || currentCredential.map(isCurrentAppSession) == true) {
          return
        }

        try writeData(
          JSONEncoder().encode(RigattiDeliveryWidgetAppSession(uid: nil, sessionVersion: sessionVersion)),
          account: appSessionAccount
        )
        if let currentCredential {
          try addPendingRevocation(currentCredential)
          guard deleteData(account: activeAccount) else {
            throw RigattiDeliveryWidgetActionError.storageFailure
          }
        }
        try writeData(
          JSONEncoder().encode(RigattiDeliveryWidgetAppSession(uid: uid, sessionVersion: sessionVersion)),
          account: appSessionAccount
        )
      }
      return true
    } catch {
      if let credential = readCredential(), isCurrentAppSession(credential) {
        _ = deleteData(account: activeAccount)
      }
      return false
    }
  }

  private static func writeCredential(_ credential: RigattiDeliveryWidgetCredential) throws {
    let data = try JSONEncoder().encode(credential)
    try writeData(data, account: activeAccount)
  }

  private static func pendingRevocations() -> [RigattiDeliveryWidgetCredential] {
    guard let data = readData(account: pendingRevocationsAccount) else { return [] }
    return (try? JSONDecoder().decode([RigattiDeliveryWidgetCredential].self, from: data)) ?? []
  }

  private static func savePendingRevocations(_ values: [RigattiDeliveryWidgetCredential]) throws {
    guard !values.isEmpty else {
      deleteData(account: pendingRevocationsAccount)
      return
    }
    try writeData(JSONEncoder().encode(values), account: pendingRevocationsAccount)
  }

  private static func addPendingRevocation(_ credential: RigattiDeliveryWidgetCredential) throws {
    var values = pendingRevocations()
    if !values.contains(where: { $0.sessionId == credential.sessionId }) {
      values.append(credential)
      try savePendingRevocations(values)
    }
  }

  private static func removePendingRevocation(sessionId: String) {
    try? withTimelineMutationLock {
      try savePendingRevocations(pendingRevocations().filter { $0.sessionId != sessionId })
    }
  }

  private static func sessionMap() -> [String: String] {
    guard let data = readData(account: receiptSessionsAccount) else { return [:] }
    return (try? JSONDecoder().decode([String: String].self, from: data)) ?? [:]
  }

  private static func saveSessionMap(_ value: [String: String]) throws {
    let data = try JSONEncoder().encode(value)
    try writeData(data, account: receiptSessionsAccount)
  }

  private static func actionRevisions() -> [String: Int] {
    guard let data = readData(account: actionRevisionsAccount) else { return [:] }
    return (try? JSONDecoder().decode([String: Int].self, from: data)) ?? [:]
  }

  private static func saveActionRevisions(_ revisions: [String: Int]) throws {
    let data = try JSONEncoder().encode(revisions)
    try writeData(data, account: actionRevisionsAccount)
  }

  private static func defaults() -> UserDefaults? {
    guard let identifier = WidgetsStorage.appGroupIdentifier else { return nil }
    return UserDefaults(suiteName: identifier)
  }

  fileprivate static func activeCredential() throws -> RigattiDeliveryWidgetCredential {
    guard let credential = readCredential(), isCurrentAppSession(credential),
          credential.absoluteExpiresAt > Date().timeIntervalSince1970 * 1000 else {
      throw RigattiDeliveryWidgetActionError.unauthorized
    }
    return credential
  }

  static func metadata() -> [String: Any]? {
    guard let credential = readCredential(), isCurrentAppSession(credential) else { return nil }
    return [
      "sessionId": credential.sessionId,
      "uid": credential.uid,
      "sessionVersion": credential.sessionVersion,
      "expiresAt": credential.expiresAt,
      "absoluteExpiresAt": credential.absoluteExpiresAt,
    ]
  }

  static func store(
    sessionId: String,
    uid: String,
    sessionVersion: Int,
    capability: String,
    expiresAt: Double,
    absoluteExpiresAt: Double
  ) async throws -> Bool {
    guard !sessionId.isEmpty, !uid.isEmpty, sessionVersion >= 0, capability.count >= 32,
          expiresAt > Date().timeIntervalSince1970 * 1000,
          absoluteExpiresAt >= expiresAt else {
      throw RigattiDeliveryWidgetActionError.storageFailure
    }

    let credential = RigattiDeliveryWidgetCredential(
      sessionId: sessionId,
      uid: uid,
      sessionVersion: sessionVersion,
      capability: capability,
      expiresAt: expiresAt,
      absoluteExpiresAt: absoluteExpiresAt
    )
    try withTimelineMutationLock {
      guard let appSession = readAppSession(),
            appSession.uid == uid, appSession.sessionVersion == sessionVersion else {
        throw RigattiDeliveryWidgetActionError.staleCredential
      }
      if let previous = readCredential(), previous.sessionId != sessionId {
        try addPendingRevocation(previous)
      }
      try writeCredential(credential)

      var mappings = sessionMap()
      mappings[sessionId] = uid
      do {
        try saveSessionMap(mappings)
      } catch {
        try? addPendingRevocation(credential)
        deleteData(account: activeAccount)
        throw RigattiDeliveryWidgetActionError.storageFailure
      }
    }
    _ = await flushPendingRevocations()
    return true
  }

  fileprivate static func renew(_ credential: RigattiDeliveryWidgetCredential, expiresAt: Double) throws {
    try withTimelineMutationLock {
      guard let current = readCredential(), current.sessionId == credential.sessionId,
            isCurrentAppSession(current),
            expiresAt > Date().timeIntervalSince1970 * 1000,
            expiresAt <= current.absoluteExpiresAt else {
        throw RigattiDeliveryWidgetActionError.staleCredential
      }
      var updated = current
      updated.expiresAt = expiresAt
      try writeCredential(updated)
    }
  }

  static func isActive(sessionId: String) -> Bool {
    guard let credential = readCredential() else { return false }
    return isCurrentAppSession(credential) && credential.sessionId == sessionId
  }

  static func revokeActive() async -> Bool {
    let credential: RigattiDeliveryWidgetCredential?
    do {
      credential = try withTimelineMutationLock {
        var currentVersion = readAppSession()?.sessionVersion ?? 0
        if currentVersion == Int.max { currentVersion = -1 }
        let nextVersion = currentVersion + 1
        try writeData(
          JSONEncoder().encode(RigattiDeliveryWidgetAppSession(uid: nil, sessionVersion: nextVersion)),
          account: appSessionAccount
        )
        let current = readCredential()
        if let current {
          try addPendingRevocation(current)
          guard deleteData(account: activeAccount) else {
            throw RigattiDeliveryWidgetActionError.storageFailure
          }
        }
        return current
      }
    } catch {
      // Keep an already fenced credential so the next app session can retry queue persistence.
      if let credential = readCredential(), isCurrentAppSession(credential) {
        _ = deleteData(account: activeAccount)
      }
      return false
    }
    guard credential != nil else { return await flushPendingRevocations() }
    return await flushPendingRevocations()
  }

  static func flushPendingRevocations() async -> Bool {
    var allRevoked = true
    guard let pending = try? withTimelineMutationLock({ pendingRevocations() }) else { return false }
    for credential in pending {
      if await RigattiDeliveryWidgetActionAPI.revoke(credential) {
        removePendingRevocation(sessionId: credential.sessionId)
      } else {
        allRevoked = false
      }
    }
    return allRevoked
  }

  static func pendingReceipts(uid: String) -> [[String: Any]] {
    guard let defaults = defaults() else { return [] }
    let mappings = sessionMap()
    return defaults.dictionaryRepresentation().compactMap { entry in
      let (key, value) = entry
      guard key.hasPrefix(receiptPrefix),
            let receipt = value as? [String: Any],
            let sessionId = receipt["sessionId"] as? String,
            mappings[sessionId] == uid,
            let date = receipt["date"] as? String,
            let revision = receipt["revision"] as? Int else { return nil }
      return ["id": String(key.dropFirst(receiptPrefix.count)), "date": date, "revision": revision]
    }
  }

  static func acknowledgeReceipts(_ identifiers: [String]) {
    try? withTimelineMutationLock {
      guard let defaults = defaults() else { return }
      for identifier in identifiers where !identifier.isEmpty {
        defaults.removeObject(forKey: receiptPrefix + identifier)
      }
      _ = defaults.synchronize()

      let activeSessionId = readCredential()?.sessionId
      let pendingSessionIds = Set(
        defaults.dictionaryRepresentation().compactMap { key, value -> String? in
          guard key.hasPrefix(receiptPrefix),
                let receipt = value as? [String: Any] else { return nil }
          return receipt["sessionId"] as? String
        }
      )
      var mappings = sessionMap()
      mappings = mappings.filter { pendingSessionIds.contains($0.key) || $0.key == activeSessionId }
      try? saveSessionMap(mappings)
      let retainedSessionIds = Set(mappings.keys)
      let revisions = actionRevisions().filter { entry in
        let (key, _) = entry
        guard let separator = key.firstIndex(of: "|") else { return false }
        return retainedSessionIds.contains(String(key[..<separator]))
      }
      try? saveActionRevisions(revisions)
    }
  }

  static func actionRevision(sessionId: String, date: String) -> Int {
    actionRevisions()["\(sessionId)|\(date)"] ?? 0
  }

  static func recordReceipt(sessionId: String, date: String, revision: Int) throws {
    try withTimelineMutationLock {
      guard let defaults = defaults() else {
        throw RigattiDeliveryWidgetActionError.storageFailure
      }
      guard sessionMap()[sessionId] != nil else {
        throw RigattiDeliveryWidgetActionError.storageFailure
      }
      guard let credential = readCredential(), credential.sessionId == sessionId,
            isCurrentAppSession(credential) else {
        throw RigattiDeliveryWidgetActionError.staleCredential
      }
      var revisions = actionRevisions()
      let revisionKey = "\(sessionId)|\(date)"
      revisions[revisionKey] = max(revisions[revisionKey] ?? 0, revision)
      try saveActionRevisions(revisions)
      let identifier = UUID().uuidString
      defaults.set(
        ["sessionId": sessionId, "date": date, "revision": revision],
        forKey: receiptPrefix + identifier
      )
      _ = defaults.synchronize()
    }
  }
}

private enum RigattiDeliveryWidgetActionAPI {
  private static let endpointInfoKey = "RigattiDeliveryWidgetActionsURL"

  private static func endpoint() throws -> URL {
    guard let value = Bundle.main.object(forInfoDictionaryKey: endpointInfoKey) as? String,
          let url = URL(string: value), url.scheme == "https" else {
      throw RigattiDeliveryWidgetActionError.unavailable
    }
    return url
  }

  private static func post(
    operation: String,
    credential: RigattiDeliveryWidgetCredential,
    fields: [String: Any] = [:]
  ) async throws -> [String: Any] {
    var request = URLRequest(url: try endpoint())
    request.httpMethod = "POST"
    request.timeoutInterval = 8
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(credential.capability)", forHTTPHeaderField: "Authorization")
    var body = fields
    body["operation"] = operation
    body["sessionId"] = credential.sessionId
    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let httpResult: (Data, URLResponse)
    do {
      httpResult = try await URLSession.shared.data(for: request)
    } catch {
      RigattiDeliveryCompletionDiagnostics.event("http_request_failed")
      throw error
    }
    let data = httpResult.0
    let response = httpResult.1
    guard let httpResponse = response as? HTTPURLResponse else {
      RigattiDeliveryCompletionDiagnostics.event("http_response_invalid")
      throw RigattiDeliveryWidgetActionError.unavailable
    }
    RigattiDeliveryCompletionDiagnostics.httpResponse(httpResponse.statusCode)
    guard (200..<300).contains(httpResponse.statusCode) else {
      RigattiDeliveryCompletionDiagnostics.event("http_response_rejected")
      throw RigattiDeliveryWidgetActionError.unavailable
    }
    let json: Any
    do {
      json = try JSONSerialization.jsonObject(with: data)
    } catch {
      RigattiDeliveryCompletionDiagnostics.event("http_payload_invalid")
      throw error
    }
    guard let result = json as? [String: Any] else {
      RigattiDeliveryCompletionDiagnostics.event("http_payload_invalid")
      throw RigattiDeliveryWidgetActionError.unavailable
    }
    return result
  }

  static func renew(_ credential: RigattiDeliveryWidgetCredential) async throws -> Double {
    let result = try await post(operation: "renew", credential: credential)
    guard let expiresAt = result["expiresAt"] as? Double,
          let absoluteExpiresAt = result["absoluteExpiresAt"] as? Double,
          absoluteExpiresAt == credential.absoluteExpiresAt,
          expiresAt > Date().timeIntervalSince1970 * 1000,
          expiresAt <= absoluteExpiresAt else {
      throw RigattiDeliveryWidgetActionError.unauthorized
    }
    return expiresAt
  }

  static func complete(
    _ credential: RigattiDeliveryWidgetCredential,
    deliveryId: String,
    date: String
  ) async throws -> [String: Any] {
    try await post(
      operation: "complete",
      credential: credential,
      fields: ["deliveryId": deliveryId, "date": date]
    )
  }

  static func revoke(_ credential: RigattiDeliveryWidgetCredential) async -> Bool {
    do {
      let result = try await post(operation: "revoke", credential: credential)
      return result["revoked"] as? Bool == true
    } catch {
      return false
    }
  }
}

@available(iOS 17.0, *)
struct RigattiDeliveryCompletionIntent: AppIntent {
  static var title: LocalizedStringResource = "Concluir entrega"
  static var isDiscoverable: Bool = false
  @available(iOS, introduced: 17.0, deprecated: 26.0)
  static var openAppWhenRun: Bool = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication

  @Parameter(title: "source") var source: String?
  @Parameter(title: "target") var target: String?
  @Parameter(title: "entryIndex") var entryIndex: Int?

  init() {}

  init(source: String?, target: String?, entryIndex: Int?) {
    self.source = source
    self.target = target
    self.entryIndex = entryIndex
  }

  static func parseTarget(_ target: String?) -> (date: String, deliveryId: String)? {
    let prefix = "rigatti-delivery-complete:"
    guard let target, target.hasPrefix(prefix) else { return nil }
    let parts = target.dropFirst(prefix.count).split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
    guard parts.count == 2 else { return nil }
    let date = String(parts[0])
    guard date.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil,
          let deliveryId = String(parts[1]).removingPercentEncoding,
          !deliveryId.isEmpty,
          deliveryId.count <= 256 else { return nil }
    return (date, deliveryId)
  }

  func perform() async throws -> some IntentResult {
    RigattiDeliveryCompletionDiagnostics.event("intent_perform_started")
    guard source == "EntregasDoDia" else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_wrong_source")
      return .result()
    }
    guard let entryIndex else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_missing_entry_index")
      return .result()
    }
    guard let action = Self.parseTarget(target) else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_invalid_target")
      return .result()
    }
    guard let timeline = WidgetsStorage.getArray(forKey: "__expo_widgets_EntregasDoDia_timeline") else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_missing_timeline")
      return .result()
    }
    guard timeline.indices.contains(entryIndex) else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_entry_index")
      return .result()
    }
    guard let entry = timeline[entryIndex] as? [String: Any],
          let props = entry["props"] as? [String: Any] else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_invalid_entry")
      return .result()
    }
    guard props["date"] as? String == action.date else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_date_mismatch")
      return .result()
    }
    guard props["state"] as? String == "pending" else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_not_pending")
      return .result()
    }
    guard let currentRows = props["deliveries"] as? [[String: Any]],
          currentRows.contains(where: { $0["id"] as? String == action.deliveryId }) else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_delivery_missing")
      return .result()
    }

    let credential: RigattiDeliveryWidgetCredential
    do {
      credential = try RigattiDeliveryWidgetKeychain.activeCredential()
      RigattiDeliveryCompletionDiagnostics.event("capability_validation_succeeded")
    } catch {
      RigattiDeliveryCompletionDiagnostics.event("capability_validation_failed")
      throw error
    }
    guard props["actionSessionId"] as? String == credential.sessionId else {
      RigattiDeliveryCompletionDiagnostics.event("session_validation_failed")
      throw RigattiDeliveryWidgetActionError.staleCredential
    }
    guard RigattiDeliveryWidgetKeychain.isActive(sessionId: credential.sessionId) else {
      RigattiDeliveryCompletionDiagnostics.event("session_validation_failed")
      throw RigattiDeliveryWidgetActionError.staleCredential
    }
    RigattiDeliveryCompletionDiagnostics.event("session_validation_succeeded")

    RigattiDeliveryCompletionDiagnostics.event("request_started")
    let result: [String: Any]
    do {
      result = try await RigattiDeliveryWidgetActionAPI.complete(
        credential,
        deliveryId: action.deliveryId,
        date: action.date
      )
    } catch {
      RigattiDeliveryCompletionDiagnostics.event("request_failed")
      throw error
    }
    RigattiDeliveryCompletionDiagnostics.event("remote_confirmation_received")
    guard let snapshot = Self.validSnapshot(result, expectedDate: action.date) else {
      RigattiDeliveryCompletionDiagnostics.event("snapshot_rejected_remote")
      throw RigattiDeliveryWidgetActionError.invalidSnapshot
    }

    do {
      try RigattiDeliveryWidgetKeychain.recordReceipt(
        sessionId: credential.sessionId,
        date: snapshot.date,
        revision: snapshot.revision
      )
      RigattiDeliveryCompletionDiagnostics.event("receipt_recorded")
    } catch {
      RigattiDeliveryCompletionDiagnostics.event("receipt_record_failed")
      throw error
    }
    let shouldReload: Bool
    do {
      shouldReload = try RigattiDeliveryWidgetKeychain.withTimelineMutationLock {
        guard RigattiDeliveryWidgetKeychain.isActive(sessionId: credential.sessionId) else {
          RigattiDeliveryCompletionDiagnostics.event("timeline_session_rejected")
          return false
        }

        let latestTimeline = WidgetsStorage.getArray(forKey: "__expo_widgets_EntregasDoDia_timeline")
          ?? timeline
        let timelineRevision = latestTimeline.compactMap { candidate -> Int? in
          guard let candidate = candidate as? [String: Any],
                let candidateProps = candidate["props"] as? [String: Any],
                candidateProps["date"] as? String == snapshot.date,
                candidateProps["actionSessionId"] as? String == credential.sessionId,
                let revision = candidateProps["actionRevision"] as? NSNumber else { return nil }
          return revision.intValue
        }.max() ?? 0
        let latestRevision = max(timelineRevision, RigattiDeliveryWidgetKeychain.actionRevision(
          sessionId: credential.sessionId,
          date: snapshot.date
        ))
        guard snapshot.revision >= latestRevision else {
          RigattiDeliveryCompletionDiagnostics.event("revision_rejected")
          return false
        }
        RigattiDeliveryCompletionDiagnostics.event("revision_accepted")

        var updatedProps: [String: Any] = [
          "date": snapshot.date,
          "state": snapshot.state,
          "deliveryCount": snapshot.deliveryCount,
          "deliveries": snapshot.deliveries,
          "actionSessionId": credential.sessionId,
          "actionRevision": snapshot.revision,
        ]
        if let deliveryRouteURL = props["deliveryRouteURL"] as? String {
          updatedProps["deliveryRouteURL"] = deliveryRouteURL
        }

        let now = Date()
        let nowMilliseconds = Int(now.timeIntervalSince1970 * 1000)
        var updatedTimeline: [[String: Any]] = [[
          "timestamp": nowMilliseconds,
          "props": updatedProps,
        ]]
        for candidate in latestTimeline {
          guard let candidate = candidate as? [String: Any],
                let timestamp = candidate["timestamp"] as? Int,
                timestamp > nowMilliseconds,
                let candidateProps = candidate["props"] as? [String: Any],
                candidateProps["date"] as? String != snapshot.date else { continue }
          updatedTimeline.append(candidate)
        }
        WidgetsStorage.set(updatedTimeline, forKey: "__expo_widgets_EntregasDoDia_timeline")
        WidgetsStorage.defaults?.synchronize()
        RigattiDeliveryCompletionDiagnostics.event("timeline_write_succeeded")
        return true
      }
    } catch {
      RigattiDeliveryCompletionDiagnostics.event("timeline_mutation_failed")
      throw error
    }
    if shouldReload {
      RigattiDeliveryCompletionDiagnostics.event("timeline_reload_requested")
      WidgetCenter.shared.reloadTimelines(ofKind: "EntregasDoDia")
    }
    return .result()
  }

  private static func validSnapshot(
    _ value: [String: Any],
    expectedDate: String
  ) -> (date: String, state: String, deliveryCount: Int, deliveries: [[String: Any]], revision: Int)? {
    guard value["snapshotComplete"] as? Bool == true,
          let date = value["date"] as? String,
          date == expectedDate,
          let state = value["state"] as? String,
          let countNumber = value["deliveryCount"] as? NSNumber,
          let rows = value["deliveries"] as? [[String: Any]],
          let revisionNumber = value["revision"] as? NSNumber else { return nil }
    let count = countNumber.intValue
    let revision = revisionNumber.intValue
    guard count >= 0, revision >= 0, count == rows.count,
          rows.allSatisfy({
            ($0["id"] as? String)?.isEmpty == false &&
            $0["clientName"] is String &&
            $0["quantityLabel"] is String &&
            $0["valueLabel"] is String
          }) else { return nil }
    guard (state == "pending" && count > 0) ||
          ((state == "all_completed" || state == "empty") && count == 0) else { return nil }
    return (date, state, count, rows, revision)
  }
}

@available(iOS 26.0, *)
extension RigattiDeliveryCompletionIntent {
  static var supportedModes: IntentModes = [.background]
}
`;

function normalizeNewlines(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return { newline, normalized: source.replace(/\r\n/g, '\n') };
}

function insertExactlyOnce(source, marker, insertion, label, idempotenceMarker) {
  const { newline, normalized } = normalizeNewlines(source);
  if (normalized.includes(idempotenceMarker)) {
    if (!normalized.includes(marker)) {
      throw new Error(
        `${label}: found a partial CNG marker in expo-widgets@${EXPECTED_EXPO_WIDGETS_VERSION}.`,
      );
    }
    return source;
  }
  const occurrences = normalized.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected one template insertion point, found ${occurrences}.`);
  }
  return normalized.replace(marker, `${insertion}\n${marker}`).replace(/\n/g, newline);
}

function ensureAppIntentsImport(source) {
  const { newline, normalized } = normalizeNewlines(source);
  const importLines = normalized.split('\n').filter((line) => line.trim() === 'import AppIntents');
  if (importLines.length > 1) {
    throw new Error('ExpoWidgets Buttons.swift contains duplicate AppIntents imports.');
  }
  if (importLines.length === 1) return source;

  const swiftUiImport = /^import SwiftUI$/gm;
  const occurrences = [...normalized.matchAll(swiftUiImport)];
  if (occurrences.length !== 1) {
    throw new Error('Could not find the unique SwiftUI import in expo-widgets Buttons.swift.');
  }
  const insertionIndex = occurrences[0].index + occurrences[0][0].length;
  return `${normalized.slice(0, insertionIndex)}\nimport AppIntents${normalized.slice(insertionIndex)}`.replace(
    /\n/g,
    newline,
  );
}

function transformButtonsSource(source) {
  const { newline, normalized } = normalizeNewlines(source);
  const startMarker = '@available(iOS 17.0, *)\nstruct WidgetButtonView: ExpoSwiftUI.View {';
  const endMarker = '@available(iOS 17.0, *)\nstruct LiveActivityButtonView: ExpoSwiftUI.View {';
  if (normalized.includes(WIDGET_BUTTON_MARKER)) {
    if (
      !normalized.includes('intent: RigattiDeliveryCompletionIntent(') ||
      !normalized.includes('source: props.source')
    ) {
      throw new Error('EntregasDoDia widget button transform is only partially present.');
    }
    return ensureAppIntentsImport(source);
  }
  const start = normalized.indexOf(startMarker);
  const end = normalized.indexOf(endMarker);
  if (start < 0 || end <= start || normalized.indexOf(startMarker, start + 1) >= 0) {
    throw new Error('Could not find the unique expo-widgets WidgetButtonView template.');
  }
  const replacement = `@available(iOS 17.0, *)
struct WidgetButtonView: ExpoSwiftUI.View {
  @ObservedObject var props: ButtonProps

  @ViewBuilder
  var body: some View {
    if RigattiDeliveryCompletionIntent.parseTarget(props.target) != nil,
       props.source == "EntregasDoDia" {
      SwiftUI.Button(
        role: props.role?.toNativeRole(),
        intent: RigattiDeliveryCompletionIntent(
          source: props.source,
          target: props.target,
          entryIndex: props.entryIndex
        )
      ) {
        buttonLabel
      }
    } else {
      SwiftUI.Button(
        role: props.role?.toNativeRole(),
        intent: WidgetUserInteraction(
          source: props.source,
          target: props.target,
          entryIndex: props.entryIndex,
          environmentString: props.environmentString
        )
      ) {
        buttonLabel
      }
    }
  }

  @ViewBuilder
  private var buttonLabel: some View {
    if let label = props.label {
      if let systemImage = props.systemImage {
        Label(title: { Text(label) }, icon: { Image(systemName: systemImage) })
      } else {
        Text(label)
      }
    } else {
      Children()
    }
  }

  ${WIDGET_BUTTON_MARKER}
}`;
  return ensureAppIntentsImport(
    `${normalized.slice(0, start)}${replacement}\n\n${normalized.slice(end)}`.replace(
      /\n/g,
      newline,
    ),
  );
}

function transformWidgetModuleSource(source) {
  return insertExactlyOnce(
    source,
    '    Name("ExpoWidgets")',
    `    ${WIDGET_MODULE_MARKER}
    Function("deliveryWidgetAuthorizationMetadata") {
      RigattiDeliveryWidgetKeychain.metadata()
    }

    Function("prepareDeliveryWidgetAuthorizationSession") { (uid: String?, sessionVersion: Int) in
      RigattiDeliveryWidgetKeychain.prepareAppSession(uid: uid, sessionVersion: sessionVersion)
    }

    AsyncFunction("storeDeliveryWidgetAuthorization") { (sessionId: String, uid: String, sessionVersion: Int, capability: String, expiresAt: Double, absoluteExpiresAt: Double) async throws -> Bool in
      try await RigattiDeliveryWidgetKeychain.store(
        sessionId: sessionId,
        uid: uid,
        sessionVersion: sessionVersion,
        capability: capability,
        expiresAt: expiresAt,
        absoluteExpiresAt: absoluteExpiresAt
      )
    }

    AsyncFunction("revokeDeliveryWidgetAuthorization") { () async -> Bool in
      await RigattiDeliveryWidgetKeychain.revokeActive()
    }

    AsyncFunction("flushDeliveryWidgetRevocations") { () async -> Bool in
      await RigattiDeliveryWidgetKeychain.flushPendingRevocations()
    }

    Function("deliveryWidgetActionRevision") { (sessionId: String, date: String) in
      RigattiDeliveryWidgetKeychain.actionRevision(sessionId: sessionId, date: date)
    }

    Function("pendingDeliveryWidgetActionReceipts") { (uid: String) in
      RigattiDeliveryWidgetKeychain.pendingReceipts(uid: uid)
    }

    Function("acknowledgeDeliveryWidgetActionReceipts") { (identifiers: [String]) in
      RigattiDeliveryWidgetKeychain.acknowledgeReceipts(identifiers)
    }`,
    'ExpoWidgets delivery action module methods',
    WIDGET_MODULE_MARKER,
  );
}

function transformWidgetObjectSource(source) {
  const marker = '  func updateTimeline(entries: [WidgetsJSTimelineEntry]) throws {';
  const { newline, normalized } = normalizeNewlines(source);
  const existing = normalized.includes(WIDGET_OBJECT_LOCK_MARKER);
  const start = normalized.indexOf(marker);
  const endMarker = '\n  func getTimeline() throws -> [WidgetsJSTimelineEntry] {';
  const end = normalized.indexOf(endMarker, start);
  if (start < 0 || end <= start || normalized.indexOf(marker, start + 1) >= 0) {
    throw new Error('Could not find the unique expo-widgets WidgetObject.updateTimeline template.');
  }
  if (existing) {
    const current = normalized.slice(start, end);
    if (
      !current.includes('withTimelineMutationLock') ||
      !current.includes('shouldAcceptAppTimeline') ||
      !current.includes(WIDGET_OBJECT_LOCK_MARKER)
    ) {
      throw new Error('EntregasDoDia app timeline lock transform is only partially present.');
    }
    return source;
  }

  const replacement = `  func updateTimeline(entries: [WidgetsJSTimelineEntry]) throws {
    if WidgetsStorage.getString(forKey: "__expo_widgets_\\(name)_layout") == nil {
      throw UpdatedTimelineWithoutLayout(name)
    }
    let dictionaries = entries.map { $0.toDictionary() }
    if name == "EntregasDoDia" {
      let written = try RigattiDeliveryWidgetKeychain.withTimelineMutationLock {
        guard RigattiDeliveryWidgetKeychain.shouldAcceptAppTimeline(dictionaries) else { return false }
        WidgetsStorage.set(dictionaries, forKey: "__expo_widgets_\\(name)_timeline")
        WidgetsStorage.defaults?.synchronize()
        return true
      }
      if written { self.reload() }
      return
    }
    WidgetsStorage.set(dictionaries, forKey: "__expo_widgets_\\(name)_timeline")
    self.reload()
  }
  ${WIDGET_OBJECT_LOCK_MARKER}`;

  return `${normalized.slice(0, start)}${replacement}${normalized.slice(end)}`.replace(
    /\n/g,
    newline,
  );
}

function transformWidgetEnvironmentSource(source) {
  return insertExactlyOnce(
    source,
    '  if #available(iOS 17.0, *) {\n    env["widgetContentMargins"]',
    `  ${WIDGET_ENVIRONMENT_MARKER}
  if #available(iOS 17.0, *) {
    env["deliveryActionsAvailable"] = true
  } else {
    env["deliveryActionsAvailable"] = false
  }
`,
    'ExpoWidgets iOS availability environment',
    WIDGET_ENVIRONMENT_MARKER,
  );
}

function addKeychainAccessGroup(entitlements, accessGroup) {
  const current = Array.isArray(entitlements['keychain-access-groups'])
    ? entitlements['keychain-access-groups'].filter((value) => typeof value === 'string')
    : [];
  entitlements['keychain-access-groups'] = [
    accessGroup,
    ...current.filter((value) => value !== accessGroup),
  ];
  return entitlements;
}

function updateExtensionPlists(projectRoot, accessGroup, endpoint) {
  const targetDirectory = path.join(projectRoot, EXTENSION_TARGET);
  const entitlementsPath = path.join(targetDirectory, `${EXTENSION_TARGET}.entitlements`);
  const infoPath = path.join(targetDirectory, 'Info.plist');
  if (!fs.existsSync(entitlementsPath) || !fs.existsSync(infoPath)) {
    throw new Error('expo-widgets did not generate ExpoWidgetsTarget entitlements and Info.plist.');
  }
  const entitlements = plist.parse(fs.readFileSync(entitlementsPath, 'utf8'));
  const groups = entitlements['com.apple.security.application-groups'];
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('ExpoWidgetsTarget is missing its generated App Group entitlement.');
  }
  fs.writeFileSync(
    entitlementsPath,
    plist.build(addKeychainAccessGroup(entitlements, accessGroup)),
  );
  const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
  if (info.NSExtension?.NSExtensionPointIdentifier !== 'com.apple.widgetkit-extension') {
    throw new Error('ExpoWidgetsTarget Info.plist has an unexpected extension point.');
  }
  info[ACTIONS_URL_INFO_KEY] = endpoint;
  info[KEYCHAIN_ACCESS_GROUP_INFO_KEY] = accessGroup;
  fs.writeFileSync(infoPath, plist.build(info));
}

function applyExpoWidgetsTemplateTransforms(projectRoot) {
  const packageJsonPath = require.resolve('expo-widgets/package.json', { paths: [projectRoot] });
  const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageInfo.version !== EXPECTED_EXPO_WIDGETS_VERSION) {
    throw new Error(
      `EntregasDoDia AppIntent plugin expects expo-widgets@${EXPECTED_EXPO_WIDGETS_VERSION}; found ${packageInfo.version}.`,
    );
  }
  const packageRoot = path.dirname(packageJsonPath);
  const swiftRoot = path.join(packageRoot, 'ios');
  const intentPath = path.join(swiftRoot, 'Widgets', 'DeliveryWidgetCompletionIntent.swift');
  const buttonsPath = path.join(swiftRoot, 'Widgets', 'Buttons.swift');
  const modulePath = path.join(swiftRoot, 'WidgetsModule.swift');
  const widgetObjectPath = path.join(swiftRoot, 'WidgetObject.swift');
  const environmentPath = path.join(swiftRoot, 'Widgets', 'Utils.swift');
  const podspecPath = path.join(swiftRoot, 'ExpoWidgets.podspec');

  for (const filePath of [
    buttonsPath,
    modulePath,
    widgetObjectPath,
    environmentPath,
    podspecPath,
  ]) {
    if (!fs.existsSync(filePath))
      throw new Error(`expo-widgets template is missing ${path.basename(filePath)}.`);
  }
  const podspec = fs.readFileSync(podspecPath, 'utf8');
  if (!podspec.includes('s.source_files = "**/*.{h,m,swift}"')) {
    throw new Error('ExpoWidgets podspec no longer includes generated Swift intent sources.');
  }
  fs.writeFileSync(buttonsPath, transformButtonsSource(fs.readFileSync(buttonsPath, 'utf8')));
  fs.writeFileSync(modulePath, transformWidgetModuleSource(fs.readFileSync(modulePath, 'utf8')));
  fs.writeFileSync(
    widgetObjectPath,
    transformWidgetObjectSource(fs.readFileSync(widgetObjectPath, 'utf8')),
  );
  fs.writeFileSync(
    environmentPath,
    transformWidgetEnvironmentSource(fs.readFileSync(environmentPath, 'utf8')),
  );

  if (fs.existsSync(intentPath)) {
    const current = fs.readFileSync(intentPath, 'utf8');
    if (!current.includes(DELIVERY_ACTION_MARKER)) {
      throw new Error(
        'Found an unrecognized DeliveryWidgetCompletionIntent.swift in expo-widgets.',
      );
    }
    if (current !== DELIVERY_ACTION_SWIFT) {
      fs.writeFileSync(intentPath, DELIVERY_ACTION_SWIFT);
    }
  } else {
    fs.writeFileSync(intentPath, DELIVERY_ACTION_SWIFT);
  }
}

function withEntregasDoDiaAppIntent(config, options) {
  const { bundleIdentifier, endpoint } = options;
  if (typeof bundleIdentifier !== 'string' || !bundleIdentifier.trim()) {
    throw new Error('withEntregasDoDiaAppIntent requires the active iOS bundle identifier.');
  }
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    throw new Error('withEntregasDoDiaAppIntent requires an HTTPS Firebase Function endpoint.');
  }
  const accessGroup = `$(AppIdentifierPrefix)${bundleIdentifier}.delivery-widget-actions`;

  config = withInfoPlist(config, (mod) => {
    mod.modResults[ACTIONS_URL_INFO_KEY] = endpoint;
    mod.modResults[KEYCHAIN_ACCESS_GROUP_INFO_KEY] = accessGroup;
    return mod;
  });

  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults = addKeychainAccessGroup(mod.modResults, accessGroup);
    return mod;
  });

  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const projectRoot = mod.modRequest.platformProjectRoot;
      applyExpoWidgetsTemplateTransforms(projectRoot);
      updateExtensionPlists(projectRoot, accessGroup, endpoint);
      return mod;
    },
  ]);
}

module.exports = withEntregasDoDiaAppIntent;
module.exports.applyExpoWidgetsTemplateTransforms = applyExpoWidgetsTemplateTransforms;
module.exports.addKeychainAccessGroup = addKeychainAccessGroup;
module.exports.transformButtonsSource = transformButtonsSource;
module.exports.transformWidgetEnvironmentSource = transformWidgetEnvironmentSource;
module.exports.transformWidgetModuleSource = transformWidgetModuleSource;
module.exports.transformWidgetObjectSource = transformWidgetObjectSource;
module.exports.updateExtensionPlists = updateExtensionPlists;
module.exports.DELIVERY_ACTION_SWIFT = DELIVERY_ACTION_SWIFT;
module.exports.ACTIONS_URL_INFO_KEY = ACTIONS_URL_INFO_KEY;
module.exports.DELIVERY_ACTION_MARKER = DELIVERY_ACTION_MARKER;
