import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  applyExpoWidgetsTemplateTransforms,
  addKeychainAccessGroup,
  transformButtonsSource,
  transformWidgetEnvironmentSource,
  transformWidgetModuleSource,
  transformWidgetObjectSource,
  updateExtensionPlists,
  DELIVERY_ACTION_SWIFT,
} = jest.requireActual<{
  applyExpoWidgetsTemplateTransforms: (projectRoot: string) => void;
  addKeychainAccessGroup: (
    entitlements: Record<string, unknown>,
    accessGroup: string,
  ) => Record<string, unknown>;
  transformButtonsSource: (source: string) => string;
  transformWidgetEnvironmentSource: (source: string) => string;
  transformWidgetModuleSource: (source: string) => string;
  transformWidgetObjectSource: (source: string) => string;
  updateExtensionPlists: (root: string, accessGroup: string, endpoint: string) => void;
  DELIVERY_ACTION_SWIFT: string;
}>('../../plugins/withEntregasDoDiaAppIntent');

const plist = jest.requireActual<{
  default: {
    build: (value: Record<string, unknown>) => string;
    parse: (value: string) => Record<string, unknown>;
  };
}>('@expo/plist').default;

const root = path.resolve(__dirname, '../..');
const buttonsPath = path.join(root, 'node_modules/expo-widgets/ios/Widgets/Buttons.swift');
const modulePath = path.join(root, 'node_modules/expo-widgets/ios/WidgetsModule.swift');
const environmentPath = path.join(root, 'node_modules/expo-widgets/ios/Widgets/Utils.swift');
const widgetObjectPath = path.join(root, 'node_modules/expo-widgets/ios/WidgetObject.swift');
const podspecPath = path.join(root, 'node_modules/expo-widgets/ios/ExpoWidgets.podspec');
const podsLinkingPath = path.join(
  root,
  'node_modules/expo-widgets/plugin/src/ios/withPodsLinking.ts',
);

describe('EntregasDoDia App Intent CNG integration', () => {
  it('generates mutable revoke session version Swift from installed templates idempotently', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigatti-widget-swift-'));
    const iosRoot = path.join(projectRoot, 'ios');
    const installedPackageRoot = path.join(root, 'node_modules/expo-widgets');
    const fixturePackageRoot = path.join(projectRoot, 'node_modules/expo-widgets');
    const templatePaths = [
      'package.json',
      'ios/Widgets/Buttons.swift',
      'ios/WidgetsModule.swift',
      'ios/WidgetObject.swift',
      'ios/Widgets/Utils.swift',
      'ios/ExpoWidgets.podspec',
    ];

    fs.mkdirSync(iosRoot, { recursive: true });
    try {
      for (const relativePath of templatePaths) {
        const destination = path.join(fixturePackageRoot, relativePath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(installedPackageRoot, relativePath), destination);
      }

      applyExpoWidgetsTemplateTransforms(iosRoot);

      const intentPath = path.join(
        fixturePackageRoot,
        'ios/Widgets/DeliveryWidgetCompletionIntent.swift',
      );
      const generatedSwift = fs.readFileSync(intentPath, 'utf8');
      expect(generatedSwift).toContain('import os');
      expect(generatedSwift).toContain('category: "WidgetOperationalErrors"');
      expect(generatedSwift).toContain(
        'subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget"',
      );
      [
        'delivery_widget_authorization_unavailable',
        'delivery_timeline_begin_failed',
        'delivery_remote_confirmation_failed',
        'delivery_remote_confirmation_invalid',
        'delivery_receipt_persist_failed',
        'delivery_timeline_session_rejected',
        'delivery_timeline_confirmation_failed',
        'live_activity_projection_failed',
        'live_activity_projection_unavailable',
        'live_activity_serialization_failed',
      ].forEach((marker) => expect(generatedSwift).toContain(marker));
      expect(generatedSwift).not.toMatch(/logger\.(?:info|debug)\(/);
      expect(generatedSwift).not.toMatch(
        /logger\.(?:info|error).*?(?:uid|deliveryId|sessionId|capability|clientName|valueLabel)/i,
      );
      expect(generatedSwift).toMatch(
        /var currentVersion = readAppSession\(\)\?\.sessionVersion \?\? 0/,
      );
      expect(generatedSwift).toMatch(/if currentVersion == Int\.max \{\s*currentVersion = -1\s*\}/);
      expect(generatedSwift).toContain('let nextVersion = currentVersion + 1');
      expect(generatedSwift).not.toMatch(/let currentVersion\s*=/);

      const generatedPaths = [
        'ios/Widgets/Buttons.swift',
        'ios/WidgetsModule.swift',
        'ios/WidgetObject.swift',
        'ios/Widgets/Utils.swift',
        'ios/Widgets/DeliveryWidgetCompletionIntent.swift',
      ].map((relativePath) => path.join(fixturePackageRoot, relativePath));
      const firstPass = generatedPaths.map((filePath) => fs.readFileSync(filePath, 'utf8'));

      applyExpoWidgetsTemplateTransforms(iosRoot);

      expect(generatedPaths.map((filePath) => fs.readFileSync(filePath, 'utf8'))).toEqual(
        firstPass,
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('transforms the installed expo-widgets@58.0.19 Swift templates idempotently', () => {
    const buttons = transformButtonsSource(fs.readFileSync(buttonsPath, 'utf8'));
    const module = transformWidgetModuleSource(fs.readFileSync(modulePath, 'utf8'));
    const environment = transformWidgetEnvironmentSource(fs.readFileSync(environmentPath, 'utf8'));
    const widgetObject = transformWidgetObjectSource(fs.readFileSync(widgetObjectPath, 'utf8'));

    expect(buttons).toMatch(/^import AppIntents$/m);
    expect(buttons).toContain('RigattiDeliveryCompletionIntent.parseTarget(props.target)');
    expect(buttons).toContain('RigattiDeliveryCompletionIntent(');
    expect(buttons).toContain('WidgetUserInteraction(');
    expect(buttons).toContain('struct LiveActivityButtonView');
    expect(transformButtonsSource(buttons)).toBe(buttons);

    expect(module).toContain('AsyncFunction("storeDeliveryWidgetAuthorization")');
    expect(module).toContain('Function("prepareDeliveryWidgetAuthorizationSession")');
    expect(module).toContain('AsyncFunction("revokeDeliveryWidgetAuthorization")');
    expect(module).toContain('Function("pendingDeliveryWidgetActionReceipts")');
    expect(module).toContain('Function("deliveryWidgetActionRevision")');
    expect(transformWidgetModuleSource(module)).toBe(module);

    expect(environment).toContain('env["deliveryActionsAvailable"] = true');
    expect(environment).toContain('env["deliveryActionsAvailable"] = false');
    expect(environment).toContain('env["widgetContentMargins"]');
    expect(transformWidgetEnvironmentSource(environment)).toBe(environment);
    expect(widgetObject).toContain('withTimelineMutationLock');
    expect(widgetObject).toContain('shouldAcceptAppTimeline');
    expect(widgetObject).toContain('preservingInFlightDeliveryActions');
    expect(widgetObject).toContain('RIGATTI_DELIVERY_WIDGET_OBJECT_LOCK_V1');
    expect(transformWidgetObjectSource(widgetObject)).toBe(widgetObject);
    expect(fs.readFileSync(podspecPath, 'utf8')).toContain('s.source_files = "**/*.{h,m,swift}"');
    expect(fs.readFileSync(podsLinkingPath, 'utf8')).toContain('use_expo_modules_widgets!');
  });

  it('migrates an already-transformed template by adding the AppIntents import once', () => {
    const transformed = transformButtonsSource(fs.readFileSync(buttonsPath, 'utf8'));
    const previousTransform = transformed.replace(/^import AppIntents\r?\n/m, '');

    const migrated = transformButtonsSource(previousTransform);

    expect(migrated).toBe(transformed);
    expect(migrated.match(/^import AppIntents$/gm)).toHaveLength(1);
    expect(transformButtonsSource(migrated)).toBe(migrated);
  });

  it('uses a native AppIntent, shows pending state before the server call, and removes only confirmed rows', () => {
    expect(DELIVERY_ACTION_SWIFT).toContain('import ActivityKit');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'struct RigattiDeliveryCompletionIntent: LiveActivityIntent',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('enum RigattiDeliveryWidgetKeychain {');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'private static let appSessionAccount = "active-app-session"',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'static func prepareAppSession(uid: String?, sessionVersion: Int) -> Bool',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'isCurrentAppSession(_ credential: RigattiDeliveryWidgetCredential)',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('let sessionVersion: Int');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'appSession.uid == uid, appSession.sessionVersion == sessionVersion',
    );
    expect(DELIVERY_ACTION_SWIFT).not.toContain('private enum RigattiDeliveryWidgetKeychain');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      '@available(iOS 26.0, *)\nextension RigattiDeliveryCompletionIntent',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'static var supportedModes: IntentModes = [.background]',
    );
    const iOS17IntentStart = DELIVERY_ACTION_SWIFT.indexOf(
      '@available(iOS 17.0, *)\nstruct RigattiDeliveryCompletionIntent',
    );
    const iOS26ModesStart = DELIVERY_ACTION_SWIFT.indexOf(
      '@available(iOS 26.0, *)\nextension RigattiDeliveryCompletionIntent',
    );
    expect(iOS17IntentStart).toBeGreaterThanOrEqual(0);
    expect(iOS26ModesStart).toBeGreaterThan(iOS17IntentStart);
    const iOS17Intent = DELIVERY_ACTION_SWIFT.slice(iOS17IntentStart, iOS26ModesStart);
    const iOS26Modes = DELIVERY_ACTION_SWIFT.slice(iOS26ModesStart);
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'static var authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication',
    );
    expect(iOS17Intent).toContain(
      'static var authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication',
    );
    expect(iOS26Modes).not.toContain('authenticationPolicy');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'fileprivate static func activeCredential() throws -> RigattiDeliveryWidgetCredential',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'fileprivate static func renew(_ credential: RigattiDeliveryWidgetCredential',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('static var openAppWhenRun: Bool = false');
    expect(DELIVERY_ACTION_SWIFT).toContain('.requiresLocalDeviceAuthentication');
    expect(DELIVERY_ACTION_SWIFT).toContain('static func beginDeliveryCompletion(');
    expect(DELIVERY_ACTION_SWIFT).toContain('static func failDeliveryCompletion(');
    expect(DELIVERY_ACTION_SWIFT).toContain('static func confirmDeliveryCompletion(');
    expect(DELIVERY_ACTION_SWIFT).toContain('static func preservingInFlightDeliveryActions(');
    expect(DELIVERY_ACTION_SWIFT).toContain('props["completedDeliveryIds"] = completedIds');
    expect(DELIVERY_ACTION_SWIFT).toContain('confirmedIds.intersection(incomingIds)');
    expect(DELIVERY_ACTION_SWIFT).toContain('actionRevisions[sessionDateKey] ?? 0');
    expect(DELIVERY_ACTION_SWIFT).toContain('"responseVersion": 2');
    const performStart = DELIVERY_ACTION_SWIFT.indexOf(
      'func perform() async throws -> some IntentResult',
    );
    const performEnd = DELIVERY_ACTION_SWIFT.indexOf(
      '\n  }\n\n  private static func validConfirmation',
      performStart,
    );
    expect(performStart).toBeGreaterThanOrEqual(0);
    expect(performEnd).toBeGreaterThan(performStart);
    const perform = DELIVERY_ACTION_SWIFT.slice(performStart, performEnd);
    expect(perform).not.toContain('RigattiDeliveryWidgetActionAPI.renew');
    expect(perform).toContain('RigattiDeliveryWidgetActionAPI.complete');
    expect(perform).toContain('RigattiDeliveryWidgetKeychain.beginDeliveryCompletion');
    expect(perform).toContain('RigattiDeliveryWidgetKeychain.failDeliveryCompletion');
    expect(perform).toContain('RigattiDeliveryWidgetKeychain.confirmDeliveryCompletion');
    expect(perform).toContain(
      'await RigattiDeliveryLiveActivityUpdater.shared.updateAfterConfirmedDelivery',
    );
    expect(perform.indexOf('RigattiDeliveryWidgetKeychain.confirmDeliveryCompletion')).toBeLessThan(
      perform.indexOf('RigattiDeliveryLiveActivityUpdater.shared.updateAfterConfirmedDelivery'),
    );
    const widgetReloadCall = 'WidgetCenter.shared.reloadTimelines(ofKind: "EntregasDoDia")';
    const pendingWidgetReloadIndex = perform.indexOf(widgetReloadCall);
    const confirmedWidgetReloadIndex = perform.lastIndexOf(widgetReloadCall);
    expect(perform.match(/WidgetCenter\.shared\.reloadTimelines\(ofKind:/g)).toHaveLength(2);
    expect(pendingWidgetReloadIndex).toBeGreaterThan(
      perform.indexOf('RigattiDeliveryWidgetKeychain.beginDeliveryCompletion'),
    );
    expect(pendingWidgetReloadIndex).toBeLessThan(
      perform.indexOf('RigattiDeliveryWidgetActionAPI.complete'),
    );
    expect(confirmedWidgetReloadIndex).toBeGreaterThan(
      perform.indexOf('RigattiDeliveryWidgetKeychain.confirmDeliveryCompletion'),
    );
    expect(confirmedWidgetReloadIndex).toBeLessThan(
      perform.indexOf('RigattiDeliveryLiveActivityUpdater.shared.updateAfterConfirmedDelivery'),
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('kSecAttrAccessGroup as String: accessGroup');
    expect(DELIVERY_ACTION_SWIFT).toContain('kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly');
    expect(DELIVERY_ACTION_SWIFT).toContain('URLSession.shared.data(for: request)');
    expect(DELIVERY_ACTION_SWIFT).toContain('value["confirmed"] as? Bool == true');
    expect(DELIVERY_ACTION_SWIFT).toContain('value["snapshotComplete"] as? Bool == true');
    expect(DELIVERY_ACTION_SWIFT).toContain('$0["id"] as? String == expectedDeliveryId');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'WidgetCenter.shared.reloadTimelines(ofKind: "EntregasDoDia")',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'WidgetsStorage.set(timeline, forKey: "__expo_widgets_EntregasDoDia_timeline")',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('static func confirmedDeliveryProjection(');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'props["completedDeliveryCount"] = completedCount < totalCount',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('totalCount - completedCount == oldCount');
    expect(DELIVERY_ACTION_SWIFT).toContain('totalCount - completedCount == count');
    expect(DELIVERY_ACTION_SWIFT).toContain('row["activityBucketCount"] as? NSNumber');
    expect(DELIVERY_ACTION_SWIFT).toContain('props["actionSessionId"] as? String == sessionId');
    expect(DELIVERY_ACTION_SWIFT).toContain('state.name == "WholesaleDeliveryLiveActivity"');
    expect(DELIVERY_ACTION_SWIFT).toContain('props["completedDeliveryCount"] = completedCount');
    expect(DELIVERY_ACTION_SWIFT).toContain('props["totalDeliveryCount"] = totalCount');
    expect(DELIVERY_ACTION_SWIFT).toContain('staleDate: content.staleDate');
    expect(DELIVERY_ACTION_SWIFT).toContain('if projection.deliveryCount == 0 {');
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'await activity.end(nextContent, dismissalPolicy: .immediate)',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain('await activity.update(nextContent)');
    expect(DELIVERY_ACTION_SWIFT).not.toMatch(/import\s+Firebase|refreshToken|adminCredential/i);
    expect(DELIVERY_ACTION_SWIFT).not.toContain('UIApplication.shared');
    const receiptStorage = DELIVERY_ACTION_SWIFT.slice(
      DELIVERY_ACTION_SWIFT.indexOf('static func recordReceipt'),
    );
    expect(receiptStorage).toContain('"sessionId": sessionId');
    expect(receiptStorage).not.toContain('"uid"');
  });

  it('fences local authorization before queueing logout revocation and preserves retry state', () => {
    const prepareStart = DELIVERY_ACTION_SWIFT.indexOf(
      'static func prepareAppSession(uid: String?, sessionVersion: Int) -> Bool',
    );
    const prepareEnd = DELIVERY_ACTION_SWIFT.indexOf(
      '\n  private static func writeCredential',
      prepareStart,
    );
    const prepareSession = DELIVERY_ACTION_SWIFT.slice(prepareStart, prepareEnd);
    const localFence = prepareSession.indexOf(
      'RigattiDeliveryWidgetAppSession(uid: nil, sessionVersion: sessionVersion)',
    );
    const queueRevocation = prepareSession.indexOf('try addPendingRevocation(currentCredential)');
    const deleteActiveCredential = prepareSession.indexOf(
      'guard deleteData(account: activeAccount) else',
    );
    const activateNewSession = prepareSession.indexOf(
      'RigattiDeliveryWidgetAppSession(uid: uid, sessionVersion: sessionVersion)',
    );

    expect(prepareStart).toBeGreaterThanOrEqual(0);
    expect(prepareEnd).toBeGreaterThan(prepareStart);
    expect(localFence).toBeGreaterThanOrEqual(0);
    expect(queueRevocation).toBeGreaterThan(localFence);
    expect(deleteActiveCredential).toBeGreaterThan(queueRevocation);
    expect(activateNewSession).toBeGreaterThan(deleteActiveCredential);
    expect(prepareSession).toContain(
      'if let credential = readCredential(), isCurrentAppSession(credential)',
    );

    const revokeStart = DELIVERY_ACTION_SWIFT.indexOf('static func revokeActive() async -> Bool');
    const revokeEnd = DELIVERY_ACTION_SWIFT.indexOf(
      '\n  static func flushPendingRevocations()',
      revokeStart,
    );
    const revokeActive = DELIVERY_ACTION_SWIFT.slice(revokeStart, revokeEnd);
    expect(
      revokeActive.indexOf(
        'RigattiDeliveryWidgetAppSession(uid: nil, sessionVersion: nextVersion)',
      ),
    ).toBeGreaterThanOrEqual(0);
    expect(revokeActive.indexOf('try addPendingRevocation(current)')).toBeGreaterThan(
      revokeActive.indexOf(
        'RigattiDeliveryWidgetAppSession(uid: nil, sessionVersion: nextVersion)',
      ),
    );
    expect(revokeActive.indexOf('guard deleteData(account: activeAccount) else')).toBeGreaterThan(
      revokeActive.indexOf('try addPendingRevocation(current)'),
    );
    expect(revokeActive).toContain(
      'if let credential = readCredential(), isCurrentAppSession(credential)',
    );
    expect(DELIVERY_ACTION_SWIFT).toContain(
      'return status == errSecSuccess || status == errSecItemNotFound',
    );
  });

  it('adds the shared Keychain access group without dropping existing capabilities', () => {
    const existing = {
      'com.apple.security.application-groups': ['group.com.pareact.mobile'],
      'keychain-access-groups': ['$(AppIdentifierPrefix)com.pareact.mobile'],
    };
    const updated = addKeychainAccessGroup(
      existing,
      '$(AppIdentifierPrefix)com.pareact.mobile.delivery-widget-actions',
    );

    expect(updated['com.apple.security.application-groups']).toEqual(['group.com.pareact.mobile']);
    expect(updated['keychain-access-groups']).toEqual([
      '$(AppIdentifierPrefix)com.pareact.mobile.delivery-widget-actions',
      '$(AppIdentifierPrefix)com.pareact.mobile',
    ]);
  });

  it('adds endpoint and shared Keychain entitlement to the generated widget target idempotently', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rigatti-widget-cng-'));
    const targetRoot = path.join(projectRoot, 'ExpoWidgetsTarget');
    const entitlementPath = path.join(targetRoot, 'ExpoWidgetsTarget.entitlements');
    const infoPath = path.join(targetRoot, 'Info.plist');
    const accessGroup = '$(AppIdentifierPrefix)com.pareact.mobile.delivery-widget-actions';
    const endpoint =
      'https://us-central1-venda-e-faturamento.cloudfunctions.net/deliveryWidgetActions';
    fs.mkdirSync(targetRoot);
    fs.writeFileSync(
      entitlementPath,
      plist.build({ 'com.apple.security.application-groups': ['group.com.pareact.mobile'] }),
    );
    fs.writeFileSync(
      infoPath,
      plist.build({
        CFBundleIdentifier: 'com.pareact.mobile.ExpoWidgetsTarget',
        NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
      }),
    );

    try {
      updateExtensionPlists(projectRoot, accessGroup, endpoint);
      updateExtensionPlists(projectRoot, accessGroup, endpoint);
      const entitlements = plist.parse(fs.readFileSync(entitlementPath, 'utf8'));
      const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));

      expect(entitlements['com.apple.security.application-groups']).toEqual([
        'group.com.pareact.mobile',
      ]);
      expect(entitlements['keychain-access-groups']).toEqual([accessGroup]);
      expect(info.RigattiDeliveryWidgetActionsURL).toBe(endpoint);
      expect(info.RigattiDeliveryWidgetKeychainAccessGroup).toBe(accessGroup);
      expect(info.NSExtension).toEqual({
        NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('fails if future templates lose the WidgetKit action insertion points', () => {
    expect(() => transformButtonsSource('struct WidgetButtonView {}')).toThrow(
      'Could not find the unique expo-widgets WidgetButtonView template.',
    );
    expect(() => transformWidgetModuleSource('Name("OtherModule")')).toThrow(
      'ExpoWidgets delivery action module methods: expected one template insertion point, found 0.',
    );
    expect(() => transformWidgetObjectSource('struct WidgetObject {}')).toThrow(
      'Could not find the unique expo-widgets WidgetObject.updateTimeline template.',
    );
  });
});
