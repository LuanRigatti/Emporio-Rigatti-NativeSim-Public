const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const EXPO_WIDGETS_VERSION = '57.0.22';
const EXPO_UI_VERSION = '57.0.21';
const LEGACY_DYNAMIC_VIEW_MARKER = '// TEMPORARY ResumoFinanceiro renderer diagnostics';
const LEGACY_IMAGE_VIEW_MARKER = '// TEMPORARY ResumoFinanceiro image loading diagnostics';
const PREVIOUS_DYNAMIC_VIEW_MARKER = `${LEGACY_DYNAMIC_VIEW_MARKER} v2`;
const PREVIOUS_IMAGE_VIEW_MARKER = `${LEGACY_IMAGE_VIEW_MARKER} v2`;
const DYNAMIC_VIEW_MARKER = `${LEGACY_DYNAMIC_VIEW_MARKER} v3`;
const IMAGE_VIEW_MARKER = `${LEGACY_IMAGE_VIEW_MARKER} v3`;

function hasUnqualifiedLoggerType(source) {
  return /(?:=|:\s*)Logger\b/.test(source);
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const matches = source.split(anchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro renderer diagnostics CNG plugin expected exactly one ' +
        label +
        ' insertion point; found ' +
        matches +
        '. Check the installed Expo Swift template before building.',
    );
  }

  return source.replace(anchor, replacement);
}

function assertPackageVersion(packageJsonPath, packageName, expectedVersion) {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      'ResumoFinanceiro renderer diagnostics could not find ' + packageJsonPath + '.',
    );
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.version !== expectedVersion) {
    throw new Error(
      'ResumoFinanceiro renderer diagnostics requires ' +
        packageName +
        '@' +
        expectedVersion +
        ', found ' +
        String(packageJson.version) +
        '.',
    );
  }
}

function transformDynamicViewSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(`${LEGACY_DYNAMIC_VIEW_MARKER}\n`)) {
    throw new Error(
      'ResumoFinanceiro renderer diagnostics found legacy DynamicView instrumentation. Restore the installed expo-widgets source before building.',
    );
  }

  if (transformed.includes(PREVIOUS_DYNAMIC_VIEW_MARKER)) {
    const previousEvents = [
      'event=renderer_enter',
      'event=renderer_complete',
      'event=renderer_appeared',
      'event=renderer_redaction_node',
      'event=renderer_failure stage=props_decode',
      'event=renderer_failure stage=children_attach',
      'event=renderer_failure stage=unsupported_node',
    ];
    const missingEvents = previousEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0) {
      throw new Error(
        'ResumoFinanceiro renderer diagnostics found partial v2 DynamicView instrumentation: ' +
          missingEvents.join(', '),
      );
    }

    transformed = replaceExactlyOnce(
      transformed,
      'import OSLog\n',
      'import os\n',
      'v2 DynamicView OSLog import migration',
    );
    transformed = replaceExactlyOnce(
      transformed,
      'private let resumoFinanceiroRendererLogger = Logger(',
      'private let resumoFinanceiroRendererLogger = os.Logger(',
      'v2 DynamicView logger qualification',
    );
    transformed = replaceExactlyOnce(
      transformed,
      'logger: Logger',
      'logger: os.Logger',
      'v2 DynamicView logger parameter qualification',
    );
    transformed = replaceExactlyOnce(
      transformed,
      PREVIOUS_DYNAMIC_VIEW_MARKER,
      DYNAMIC_VIEW_MARKER,
      'v2 DynamicView marker upgrade',
    );
    if (hasUnqualifiedLoggerType(transformed)) {
      throw new Error(
        'ResumoFinanceiro renderer diagnostics could not qualify every Logger reference in v2 DynamicView instrumentation.',
      );
    }
    return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
  }

  if (transformed.includes(DYNAMIC_VIEW_MARKER)) {
    const expectedEvents = [
      'event=renderer_enter',
      'event=renderer_complete',
      'event=renderer_appeared',
      'event=renderer_redaction_node',
      'fallback=empty_view',
      'event=renderer_failure stage=props_decode',
      'event=renderer_failure stage=children_attach',
      'event=renderer_failure stage=unsupported_node',
      'import os',
      'resumoFinanceiroRendererLogger = os.Logger(',
      'logger: os.Logger',
    ];
    const missingEvents = expectedEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0 || hasUnqualifiedLoggerType(transformed)) {
      throw new Error(
        'ResumoFinanceiro renderer diagnostics found a partial DynamicView marker: ' +
          [
            ...missingEvents,
            ...(hasUnqualifiedLoggerType(transformed) ? ['qualified os.Logger'] : []),
          ].join(', '),
      );
    }
    return source;
  }

  transformed = replaceExactlyOnce(
    transformed,
    'import SwiftUI\n',
    'import SwiftUI\nimport os\n',
    'DynamicView os.Logger import',
  );
  transformed = replaceExactlyOnce(
    transformed,
    'public struct WidgetsDynamicView: View, ExpoSwiftUI.AnyChild {\n  let node: [String: Any]',
    'public struct WidgetsDynamicView: View, ExpoSwiftUI.AnyChild {\n  @Environment(\\.redactionReasons) private var widgetRedactionReasons\n  let node: [String: Any]',
    'DynamicView redaction environment',
  );
  transformed = replaceExactlyOnce(
    transformed,
    'import ExpoUI\n',
    [
      'import ExpoUI',
      '',
      DYNAMIC_VIEW_MARKER,
      'private let resumoFinanceiroRendererLogger = os.Logger(',
      '  subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",',
      '  category: "RigattiWidgetSync"',
      ')',
      '',
      'private func isResumoFinanceiroDiagnostic(_ name: String, _ kind: WidgetsKind) -> Bool {',
      '  name == "ResumoFinanceiro" && kind == .widget',
      '}',
      '',
      'private func resumoFinanceiroUnsupportedNodeFallback(name: String, kind: WidgetsKind, logger: os.Logger) -> EmptyView {',
      '  guard isResumoFinanceiroDiagnostic(name, kind) else { return EmptyView() }',
      '  let _ = logger.error("event=renderer_failure stage=unsupported_node fallback=empty_view")',
      '  return EmptyView()',
      '}',
      '',
      'private func resumoFinanceiroRendererToken(_ value: String) -> String {',
      '  var token = ""',
      '  for scalar in value.unicodeScalars {',
      '    let code = scalar.value',
      '    let isAsciiLetterOrDigit = (48...57).contains(code) || (65...90).contains(code) || (97...122).contains(code)',
      '    if isAsciiLetterOrDigit || code == 46 || code == 95 || code == 45 {',
      '      token += String(scalar)',
      '    } else {',
      '      token += "_"',
      '    }',
      '    if token.count >= 80 { break }',
      '  }',
      '  return token.isEmpty ? "unknown" : token',
      '}',
      '',
      'private func resumoFinanceiroRendererErrorFields(_ error: Error) -> (type: String, domain: String, code: Int) {',
      '  let nsError = error as NSError',
      '  let safeDomain: String',
      '  switch nsError.domain {',
      '  case "NSCocoaErrorDomain", "NSPOSIXErrorDomain", "NSOSStatusErrorDomain", "NSURLErrorDomain":',
      '    safeDomain = nsError.domain',
      '  default:',
      '    safeDomain = "omitted"',
      '  }',
      '  return (resumoFinanceiroRendererToken(String(reflecting: type(of: error))), safeDomain, nsError.code)',
      '}',
      '',
    ].join('\n'),
    'DynamicView logger and safe error metadata',
  );

  const unknownNodeAnchor = ['#else', '    default:', '      EmptyView()', '#endif'].join('\n');
  const unknownNodeReplacement = [
    '#else',
    '    default:',
    '      resumoFinanceiroUnsupportedNodeFallback(name: name, kind: kind, logger: resumoFinanceiroRendererLogger)',
    '#endif',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    unknownNodeAnchor,
    unknownNodeReplacement,
    'Release unknown node fallback',
  );

  const renderStart =
    '  @ViewBuilder\n  private func render<P, V>(_ viewType: V.Type, _ propsType: P.Type, updateProps: ((_ initialProps: P) throws -> Void)? = nil) -> some View';
  const renderEnd = '\n\n  // MARK: - Function that sets children as DynamicView';
  const startIndex = transformed.indexOf(renderStart);
  const endIndex = transformed.indexOf(renderEnd, startIndex);
  if (startIndex < 0 || endIndex < 0 || transformed.indexOf(renderStart, startIndex + 1) >= 0) {
    throw new Error(
      'ResumoFinanceiro renderer diagnostics CNG plugin could not locate the unique DynamicView.render method.',
    );
  }

  const renderReplacement = [
    '  @ViewBuilder',
    '  private func render<P, V>(_ viewType: V.Type, _ propsType: P.Type, updateProps: ((_ initialProps: P) throws -> Void)? = nil) -> some View',
    '  where P: UIBaseViewProps, V: ExpoSwiftUI.View, V.Props == P {',
    '    {',
    '      let viewName = String(describing: V.self)',
    '      let shouldTrace = isResumoFinanceiroDiagnostic(name, kind)',
    '      let isRedactionInspectableView = ["TextView", "ImageView", "RoundedRectangleView", "VStackView", "HStackView"].contains(viewName)',
    '      if shouldTrace && isRedactionInspectableView {',
    '        let hasPlaceholderRedaction = widgetRedactionReasons.contains(.placeholder)',
    '        let hasPrivacyRedaction = widgetRedactionReasons.contains(.privacy)',
    '        let _ = resumoFinanceiroRendererLogger.info("event=renderer_redaction_node view=\\(viewName, privacy: .public) placeholder=\\(hasPlaceholderRedaction, privacy: .public) privacy=\\(hasPrivacyRedaction, privacy: .public)")',
    '      }',
    '      let propsPresent = node["props"] is [String: Any]',
    '      let rawProps = node["props"] as? [String: Any]',
    '      let childrenCount = (rawProps?["children"] as? [Any])?.count ?? 0',
    '      let modifierCount = (rawProps?["modifiers"] as? [Any])?.count ?? 0',
    '      if shouldTrace { let _ = resumoFinanceiroRendererLogger.info("event=renderer_enter view=\\(viewName, privacy: .public) props_present=\\(propsPresent, privacy: .public) children_count=\\(childrenCount, privacy: .public) modifier_count=\\(modifierCount, privacy: .public)") }',
    '      guard let rawProps = node["props"] as? [String: Any] else {',
    '        if shouldTrace { let _ = resumoFinanceiroRendererLogger.error("event=renderer_failure stage=missing_props fallback=empty_view view=\\(viewName, privacy: .public)") }',
    '        return AnyView(EmptyView())',
    '      }',
    '',
    '      let props: P',
    '      do {',
    '        props = try propsType.init(rawProps: rawProps, context: WidgetsContext.shared.context)',
    '      } catch {',
    '        let fields = resumoFinanceiroRendererErrorFields(error)',
    '        if shouldTrace { let _ = resumoFinanceiroRendererLogger.error("event=renderer_failure stage=props_decode fallback=empty_view view=\\(viewName, privacy: .public) error_type=\\(fields.type, privacy: .public) error_domain=\\(fields.domain, privacy: .public) error_code=\\(fields.code, privacy: .public)") }',
    '        return AnyView(EmptyView())',
    '      }',
    '',
    '      do {',
    '        try updateProps?(props)',
    '      } catch {',
    '        let fields = resumoFinanceiroRendererErrorFields(error)',
    '        if shouldTrace { let _ = resumoFinanceiroRendererLogger.error("event=renderer_failure stage=children_attach fallback=empty_view view=\\(viewName, privacy: .public) error_type=\\(fields.type, privacy: .public) error_domain=\\(fields.domain, privacy: .public) error_code=\\(fields.code, privacy: .public)") }',
    '        return AnyView(EmptyView())',
    '      }',
    '',
    '      let host = UIBaseView<P, V>(props: props)',
    '        .transition(.identity)',
    '        .onAppear {',
    '          if shouldTrace { let _ = resumoFinanceiroRendererLogger.info("event=renderer_appeared view=\\(viewName, privacy: .public)") }',
    '        }',
    '      if shouldTrace { let _ = resumoFinanceiroRendererLogger.info("event=renderer_complete view=\\(viewName, privacy: .public) stage=host_constructed") }',
    '      return AnyView(host)',
    '    }()',
    '  }',
  ].join('\n');
  transformed = transformed.slice(0, startIndex) + renderReplacement + transformed.slice(endIndex);

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function transformImageViewSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(`${LEGACY_IMAGE_VIEW_MARKER}\n`)) {
    throw new Error(
      'ResumoFinanceiro renderer diagnostics found legacy ImageView instrumentation. Restore the installed @expo/ui source before building.',
    );
  }

  if (transformed.includes(PREVIOUS_IMAGE_VIEW_MARKER)) {
    const previousEvents = [
      'event=image_load_start',
      'event=image_load_result',
      'event=image_load_failure',
      'rgba_estimate_bytes=',
    ];
    const missingEvents = previousEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0) {
      throw new Error(
        'ResumoFinanceiro renderer diagnostics found partial v2 ImageView instrumentation: ' +
          missingEvents.join(', '),
      );
    }

    transformed = replaceExactlyOnce(
      transformed,
      'import OSLog\n',
      'import os\n',
      'v2 ImageView OSLog import migration',
    );
    transformed = replaceExactlyOnce(
      transformed,
      'private let imageDiagnosticsLogger = Logger(',
      'private let imageDiagnosticsLogger = os.Logger(',
      'v2 ImageView logger qualification',
    );
    transformed = replaceExactlyOnce(
      transformed,
      PREVIOUS_IMAGE_VIEW_MARKER,
      IMAGE_VIEW_MARKER,
      'v2 ImageView marker upgrade',
    );
    if (hasUnqualifiedLoggerType(transformed)) {
      throw new Error(
        'ResumoFinanceiro renderer diagnostics could not qualify every Logger reference in v2 ImageView instrumentation.',
      );
    }
    return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
  }

  if (transformed.includes(IMAGE_VIEW_MARKER)) {
    const expectedEvents = [
      'event=image_load_start',
      'event=image_load_result',
      'event=image_load_failure',
      'rgba_estimate_bytes=',
      'import os',
      'imageDiagnosticsLogger = os.Logger(',
    ];
    const missingEvents = expectedEvents.filter((event) => !transformed.includes(event));
    if (missingEvents.length > 0 || hasUnqualifiedLoggerType(transformed)) {
      throw new Error(
        'ResumoFinanceiro renderer diagnostics found a partial ImageView marker: ' +
          [
            ...missingEvents,
            ...(hasUnqualifiedLoggerType(transformed) ? ['qualified os.Logger'] : []),
          ].join(', '),
      );
    }
    return source;
  }

  transformed = replaceExactlyOnce(
    transformed,
    'import SwiftUI\n',
    'import SwiftUI\nimport os\n',
    'ImageView os.Logger import',
  );
  transformed = replaceExactlyOnce(
    transformed,
    'public struct ImageView: ExpoSwiftUI.View {\n  @ObservedObject public var props: ImageViewProps',
    [
      'public struct ImageView: ExpoSwiftUI.View {',
      '  @ObservedObject public var props: ImageViewProps',
      '',
      IMAGE_VIEW_MARKER,
      '  private let imageDiagnosticsLogger = os.Logger(',
      '    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile",',
      '    category: "RigattiWidgetSync"',
      '  )',
      '',
      '  private func isResumoFinanceiroSplashImage(_ source: String?) -> Bool {',
      '    guard Bundle.main.bundleURL.pathExtension == "appex", let source else { return false }',
      '    return source.hasSuffix("resumo-financeiro-mark-light.png") || source.hasSuffix("resumo-financeiro-mark-dark.png")',
      '  }',
      '',
      '  private func logImageInfo(_ message: String) {',
      '    guard let source = props.uiImage, isResumoFinanceiroSplashImage(source) else { return }',
      '    let _ = imageDiagnosticsLogger.info("\\(message, privacy: .public)")',
      '  }',
      '',
      '  private func logImageError(_ message: String) {',
      '    guard let source = props.uiImage, isResumoFinanceiroSplashImage(source) else { return }',
      '    let _ = imageDiagnosticsLogger.error("\\(message, privacy: .public)")',
      '  }',
      '',
      '  private func imageDiagnosticErrorFields(_ error: Error) -> (type: String, domain: String, code: Int) {',
      '    let nsError = error as NSError',
      '    let rawType = String(reflecting: type(of: error))',
      '    let safeType = String(rawType.unicodeScalars.prefix(80).map { scalar in',
      '      let code = scalar.value',
      '      let isAsciiLetterOrDigit = (48...57).contains(code) || (65...90).contains(code) || (97...122).contains(code)',
      '      return isAsciiLetterOrDigit || code == 46 || code == 95 || code == 45 ? String(scalar) : "_"',
      '    }.joined())',
      '    let safeDomain = ["NSCocoaErrorDomain", "NSPOSIXErrorDomain", "NSOSStatusErrorDomain", "NSURLErrorDomain"].contains(nsError.domain) ? nsError.domain : "omitted"',
      '    return (safeType.isEmpty ? "unknown" : safeType, safeDomain, nsError.code)',
      '  }',
      '',
      '  private func loadDiagnosticImage(_ source: String?) -> UIImage? {',
      '    guard let source else { return nil }',
      '    guard isResumoFinanceiroSplashImage(source) else {',
      '      guard let url = URL(string: source), let data = try? Data(contentsOf: url) else { return nil }',
      '      return UIImage(data: data)',
      '    }',
      '    logImageInfo("event=image_load_start source_present=true")',
      '    guard let url = URL(string: source) else {',
      '      logImageError("event=image_load_failure stage=invalid_url")',
      '      return nil',
      '    }',
      '    let data: Data',
      '    do {',
      '      data = try Data(contentsOf: url)',
      '    } catch {',
      '      let fields = imageDiagnosticErrorFields(error)',
      '      logImageError("event=image_load_failure stage=read error_type=\\(fields.type) error_domain=\\(fields.domain) error_code=\\(fields.code)")',
      '      return nil',
      '    }',
      '    guard let image = UIImage(data: data) else {',
      '      logImageError("event=image_load_failure stage=decode bytes=\\(data.count)")',
      '      return nil',
      '    }',
      '    let pixelWidth = Int(image.size.width * image.scale)',
      '    let pixelHeight = Int(image.size.height * image.scale)',
      '    let estimatedRgbaBytes = pixelWidth * pixelHeight * 4',
      '    logImageInfo("event=image_load_result success=true pixel_width=\\(pixelWidth) pixel_height=\\(pixelHeight) bytes=\\(data.count) rgba_estimate_bytes=\\(estimatedRgbaBytes)")',
      '    return image',
      '  }',
    ].join('\n'),
    'ImageView image loader diagnostics',
  );

  const imageBranchAnchor = [
    '    } else if let url = props.uiImage,',
    '              let url = URL(string: url),',
    '              let data = try? Data(contentsOf: url),',
    '              let uiImage = UIImage(data: data) {',
  ].join('\n');
  const imageBranchReplacement = [
    '    } else if let uiImage = loadDiagnosticImage(props.uiImage) {',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    imageBranchAnchor,
    imageBranchReplacement,
    'UIImage load branch',
  );

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function withResumoFinanceiroRendererDiagnostics(config) {
  return withDangerousMod(config, [
    'ios',
    async (configWithIos) => {
      const projectRoot = path.resolve(configWithIos.modRequest.platformProjectRoot, '..');
      const nodeModulesRoot = path.join(projectRoot, 'node_modules');
      const expoWidgetsPackageJson = path.join(nodeModulesRoot, 'expo-widgets', 'package.json');
      const expoUiPackageJson = path.join(nodeModulesRoot, '@expo', 'ui', 'package.json');
      assertPackageVersion(expoWidgetsPackageJson, 'expo-widgets', EXPO_WIDGETS_VERSION);
      assertPackageVersion(expoUiPackageJson, '@expo/ui', EXPO_UI_VERSION);

      const targets = [
        {
          path: path.join(nodeModulesRoot, 'expo-widgets', 'ios', 'Widgets', 'DynamicView.swift'),
          transform: transformDynamicViewSource,
          label: 'expo-widgets DynamicView.swift',
        },
        {
          path: path.join(nodeModulesRoot, '@expo', 'ui', 'ios', 'ImageView.swift'),
          transform: transformImageViewSource,
          label: '@expo/ui ImageView.swift',
        },
      ];

      const transformedTargets = targets.map((target) => {
        if (!fs.existsSync(target.path)) {
          throw new Error(
            'ResumoFinanceiro renderer diagnostics could not find ' +
              target.label +
              ' at ' +
              target.path +
              '.',
          );
        }
        const originalSource = fs.readFileSync(target.path, 'utf8');
        const instrumentedSource = target.transform(originalSource);
        return { ...target, originalSource, instrumentedSource };
      });

      for (const target of transformedTargets) {
        if (target.instrumentedSource !== target.originalSource) {
          fs.writeFileSync(target.path, target.instrumentedSource);
        }
      }

      return configWithIos;
    },
  ]);
}

module.exports = withResumoFinanceiroRendererDiagnostics;
module.exports.assertPackageVersion = assertPackageVersion;
module.exports.transformDynamicViewSource = transformDynamicViewSource;
module.exports.transformImageViewSource = transformImageViewSource;
