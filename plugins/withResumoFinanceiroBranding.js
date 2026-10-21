const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const EXPO_WIDGETS_VERSION = '58.0.19';
const BRANDING_MARKER = '// ResumoFinanceiro shared branding image directory';
const LIVE_ACTIVITY_BRANDING_MARKER = '// Rigatti Live Activity shared branding image directory';
const WIDGET_PROVIDER_ERROR_MARKER = '// Rigatti WidgetKit operational error logging';
const WIDGET_PROVIDER_ANCHOR = 'public struct WidgetsTimelineProvider: TimelineProvider {\n';
const ENVIRONMENT_HELPER_ANCHOR =
  'public func getWidgetEnvironment(environment: EnvironmentValues) -> [String: Any] {';
const ENVIRONMENT_INSERTION_ANCHOR = '  if #available(iOS 17.0, *) {';
const LIVE_ACTIVITY_ENVIRONMENT_HELPER_ANCHOR =
  'func getLiveActivityEnvironment(for environment: EnvironmentValues, in context: ActivityViewContext<LiveActivityAttributes>) -> [String: Any] {';
const LIVE_ACTIVITY_ENVIRONMENT_INSERTION_ANCHOR = '  if #available(iOS 18.0, *) {';

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const matches = countOccurrences(source, anchor);
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one ' +
        label +
        ' insertion point; found ' +
        matches +
        '. Check the expo-widgets@' +
        EXPO_WIDGETS_VERSION +
        ' generated Swift before building.',
    );
  }

  return source.replace(anchor, replacement);
}

function ensureFoundationImport(source) {
  const count = countOccurrences(source, 'import Foundation\n');
  if (count === 1) return source;
  if (count > 1) {
    throw new Error('ResumoFinanceiro branding CNG plugin found duplicate Foundation imports.');
  }

  const importAnchor = 'import SwiftUI\n';
  return replaceExactlyOnce(
    source,
    importAnchor,
    `${importAnchor}import Foundation\n`,
    'Foundation import',
  );
}

function ensureSwiftImport(source, importName, anchor) {
  const importLine = `import ${importName}\n`;
  const count = countOccurrences(source, importLine);
  if (count === 1) return source;
  if (count > 1) {
    throw new Error(`ResumoFinanceiro branding CNG plugin found duplicate ${importName} imports.`);
  }
  return replaceExactlyOnce(source, anchor, `${anchor}${importLine}`, `${importName} import`);
}

function transformExpoWidgetsUtilsSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(BRANDING_MARKER)) {
    const widgetEnvironmentStart = transformed.indexOf(ENVIRONMENT_HELPER_ANCHOR);
    const widgetEnvironmentEnd = transformed.indexOf('  return env', widgetEnvironmentStart);
    const widgetEnvironment = transformed.slice(widgetEnvironmentStart, widgetEnvironmentEnd);
    const expectedFragments = [
      'Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String',
      'FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)',
      'env["widgetsDirectory"] =',
      'appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    ];
    if (
      countOccurrences(transformed, BRANDING_MARKER) !== 1 ||
      countOccurrences(transformed, 'import Foundation\n') !== 1 ||
      countOccurrences(transformed, ENVIRONMENT_HELPER_ANCHOR) !== 1 ||
      widgetEnvironmentEnd === -1 ||
      expectedFragments.some((fragment) => countOccurrences(widgetEnvironment, fragment) !== 1)
    ) {
      throw new Error(
        'ResumoFinanceiro branding CNG plugin found a partial or duplicated shared image path marker.',
      );
    }
    return transformLiveActivityEnvironmentSource(source);
  }

  if (transformed.includes('env["widgetsDirectory"] =')) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin found an unmarked widgetsDirectory assignment; review the installed Expo Widgets source.',
    );
  }

  transformed = ensureFoundationImport(transformed);
  if (countOccurrences(transformed, ENVIRONMENT_HELPER_ANCHOR) !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one getWidgetEnvironment helper; check the installed Expo Widgets source.',
    );
  }

  const environmentInjection = [
    `  ${BRANDING_MARKER}`,
    '  if let appGroupIdentifier = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,',
    '     let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {',
    '    env["widgetsDirectory"] = appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    '  }',
    ENVIRONMENT_INSERTION_ANCHOR,
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    ENVIRONMENT_INSERTION_ANCHOR,
    environmentInjection,
    'shared image directory',
  );

  const output = newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
  return transformLiveActivityEnvironmentSource(output);
}

function transformLiveActivityEnvironmentSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');
  const helperStart = transformed.indexOf(LIVE_ACTIVITY_ENVIRONMENT_HELPER_ANCHOR);
  if (
    helperStart === -1 ||
    countOccurrences(transformed, LIVE_ACTIVITY_ENVIRONMENT_HELPER_ANCHOR) !== 1
  ) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one getLiveActivityEnvironment helper; check the installed Expo Widgets source.',
    );
  }

  const helperEnd = transformed.indexOf('  return env', helperStart);
  if (helperEnd === -1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find the getLiveActivityEnvironment return point.',
    );
  }
  const liveActivityEnvironment = transformed.slice(helperStart, helperEnd);

  if (liveActivityEnvironment.includes(LIVE_ACTIVITY_BRANDING_MARKER)) {
    const expectedFragments = [
      'Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String',
      'FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)',
      'env["widgetsDirectory"] =',
      'appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    ];
    if (
      countOccurrences(liveActivityEnvironment, LIVE_ACTIVITY_BRANDING_MARKER) !== 1 ||
      expectedFragments.some(
        (fragment) => countOccurrences(liveActivityEnvironment, fragment) !== 1,
      )
    ) {
      throw new Error(
        'ResumoFinanceiro branding CNG plugin found a partial or duplicated Live Activity image path marker.',
      );
    }
    return source;
  }

  if (liveActivityEnvironment.includes('env["widgetsDirectory"] =')) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin found an unmarked Live Activity widgetsDirectory assignment.',
    );
  }

  const environmentInjection = [
    `  ${LIVE_ACTIVITY_BRANDING_MARKER}`,
    '  if let appGroupIdentifier = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,',
    '     let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {',
    '    env["widgetsDirectory"] = appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    '  }',
    LIVE_ACTIVITY_ENVIRONMENT_INSERTION_ANCHOR,
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    LIVE_ACTIVITY_ENVIRONMENT_INSERTION_ANCHOR,
    environmentInjection,
    'Live Activity shared image directory',
  );

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function transformWidgetTimelineOperationalErrorsSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');
  const loggerDeclaration =
    '  private let operationalErrorLogger = os.Logger(\n' +
    '    subsystem: Bundle.main.bundleIdentifier ?? "com.pareact.mobile.ExpoWidgetsTarget",\n' +
    '    category: "WidgetOperationalErrors"\n' +
    '  )';
  const errorEvent = 'operationalErrorLogger.error("event=widget_app_group_identifier_missing")';

  if (transformed.includes(WIDGET_PROVIDER_ERROR_MARKER)) {
    if (
      countOccurrences(transformed, WIDGET_PROVIDER_ERROR_MARKER) !== 1 ||
      countOccurrences(transformed, loggerDeclaration) !== 1 ||
      countOccurrences(transformed, errorEvent) !== 1
    ) {
      throw new Error(
        'Widget operational error logging found partial or duplicated instrumentation.',
      );
    }
    return source;
  }

  transformed = ensureSwiftImport(transformed, 'os', 'import WidgetKit\n');
  transformed = replaceExactlyOnce(
    transformed,
    WIDGET_PROVIDER_ANCHOR,
    `${WIDGET_PROVIDER_ANCHOR}  ${WIDGET_PROVIDER_ERROR_MARKER}\n${loggerDeclaration}\n\n`,
    'WidgetKit provider operational error logger',
  );
  transformed = replaceExactlyOnce(
    transformed,
    '      fatalError("Could not get the app group identifier from Info.plist")',
    `      ${errorEvent}\n      fatalError("Could not get the app group identifier from Info.plist")`,
    'missing App Group operational error log',
  );

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function assertExpoWidgetsVersion(packageRoot) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find expo-widgets package metadata at ' +
        packageJsonPath +
        '.',
    );
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.version !== EXPO_WIDGETS_VERSION) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin supports expo-widgets@' +
        EXPO_WIDGETS_VERSION +
        '; found ' +
        packageJson.version +
        '.',
    );
  }
}

function transformExpoWidgetsTarget(projectRoot, packageRoot) {
  const resolvedPackageRoot =
    packageRoot ?? path.resolve(projectRoot, '..', 'node_modules', 'expo-widgets');
  assertExpoWidgetsVersion(resolvedPackageRoot);

  const utilsPath = path.join(resolvedPackageRoot, 'ios', 'Widgets', 'Utils.swift');
  if (!fs.existsSync(utilsPath)) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find expo-widgets Utils.swift at ' +
        utilsPath +
        '.',
    );
  }

  const originalUtils = fs.readFileSync(utilsPath, 'utf8');
  const transformedUtils = transformExpoWidgetsUtilsSource(originalUtils);
  if (transformedUtils !== originalUtils) fs.writeFileSync(utilsPath, transformedUtils);

  const timelineProviderPath = path.join(
    resolvedPackageRoot,
    'ios',
    'Widgets',
    'TimelineProvider.swift',
  );
  if (!fs.existsSync(timelineProviderPath)) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find expo-widgets TimelineProvider.swift at ' +
        timelineProviderPath +
        '.',
    );
  }
  const originalTimelineProvider = fs.readFileSync(timelineProviderPath, 'utf8');
  const transformedTimelineProvider =
    transformWidgetTimelineOperationalErrorsSource(originalTimelineProvider);
  if (transformedTimelineProvider !== originalTimelineProvider) {
    fs.writeFileSync(timelineProviderPath, transformedTimelineProvider);
  }
}

function withResumoFinanceiroBranding(config) {
  return withDangerousMod(config, [
    'ios',
    async (configWithIos) => {
      transformExpoWidgetsTarget(configWithIos.modRequest.platformProjectRoot);
      return configWithIos;
    },
  ]);
}

module.exports = withResumoFinanceiroBranding;
module.exports.transformExpoWidgetsTarget = transformExpoWidgetsTarget;
module.exports.transformExpoWidgetsUtilsSource = transformExpoWidgetsUtilsSource;
module.exports.transformWidgetTimelineOperationalErrorsSource =
  transformWidgetTimelineOperationalErrorsSource;
