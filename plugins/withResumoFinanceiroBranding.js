const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const EXPO_WIDGETS_VERSION = '57.0.22';
const WIDGET_SOURCE_NAMES = ['ResumoFinanceiro.swift', 'EntregasDoDia.swift'];
const BRANDING_MARKER = '// ResumoFinanceiro shared branding image directory';
const ENVIRONMENT_HELPER_ANCHOR =
  'public func getWidgetEnvironment(environment: EnvironmentValues) -> [String: Any] {';
const ENVIRONMENT_INSERTION_ANCHOR = '  if #available(iOS 16.0, *) {';
const SHARED_ENTRY_VIEW_ANCHOR =
  '    var env: [String: Any] = getWidgetEnvironment(environment: environment)';

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

function transformExpoWidgetsUtilsSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(BRANDING_MARKER)) {
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
      expectedFragments.some((fragment) => countOccurrences(transformed, fragment) !== 1)
    ) {
      throw new Error(
        'ResumoFinanceiro branding CNG plugin found a partial or duplicated shared image path marker.',
      );
    }
    return source;
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

function readRequiredSource(sourcePath, label) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin could not find ' + label + ' at ' + sourcePath + '.',
    );
  }
  return fs.readFileSync(sourcePath, 'utf8');
}

function assertExactlyOne(source, value, label) {
  const matches = countOccurrences(source, value);
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one ' +
        label +
        '; found ' +
        matches +
        '. Check the expo-widgets@' +
        EXPO_WIDGETS_VERSION +
        ' generated Swift before building.',
    );
  }
}

function transformExpoWidgetsTarget(projectRoot, packageRoot) {
  const targetDirectory = path.join(projectRoot, 'ExpoWidgetsTarget');
  const resolvedPackageRoot =
    packageRoot ?? path.resolve(projectRoot, '..', 'node_modules', 'expo-widgets');
  assertExpoWidgetsVersion(resolvedPackageRoot);

  const widgetSources = Object.fromEntries(
    WIDGET_SOURCE_NAMES.map((sourceName) => [
      sourceName,
      readRequiredSource(path.join(targetDirectory, sourceName), sourceName),
    ]),
  );

  assertExactlyOne(
    widgetSources['ResumoFinanceiro.swift'],
    'AppIntentConfiguration(',
    'ResumoFinanceiro App Intent configuration',
  );
  assertExactlyOne(
    widgetSources['ResumoFinanceiro.swift'],
    'getWidgetEnvironment(environment: environment)',
    'ResumoFinanceiro environment helper call',
  );
  assertExactlyOne(
    widgetSources['EntregasDoDia.swift'],
    'StaticConfiguration(',
    'EntregasDoDia static configuration',
  );
  assertExactlyOne(
    widgetSources['EntregasDoDia.swift'],
    'WidgetsEntryView(entry: entry)',
    'EntregasDoDia shared entry view',
  );

  const sharedEntryViewPath = path.join(resolvedPackageRoot, 'ios', 'Widgets', 'EntryView.swift');
  const sharedEntryView = readRequiredSource(sharedEntryViewPath, 'shared WidgetsEntryView');
  assertExactlyOne(
    sharedEntryView,
    SHARED_ENTRY_VIEW_ANCHOR,
    'shared WidgetsEntryView environment helper call',
  );

  const utilsPath = path.join(resolvedPackageRoot, 'ios', 'Widgets', 'Utils.swift');
  const originalUtils = readRequiredSource(utilsPath, 'expo-widgets Utils.swift');
  const transformedUtils = transformExpoWidgetsUtilsSource(originalUtils);
  if (transformedUtils !== originalUtils) {
    fs.writeFileSync(utilsPath, transformedUtils);
  }
}

function withResumoFinanceiroBranding(config) {
  return withDangerousMod(config, [
    'ios',
    async (configWithIos) => {
      const projectRoot = configWithIos.modRequest.platformProjectRoot;
      transformExpoWidgetsTarget(projectRoot);
      return configWithIos;
    },
  ]);
}

module.exports = withResumoFinanceiroBranding;
module.exports.transformExpoWidgetsUtilsSource = transformExpoWidgetsUtilsSource;
module.exports.transformExpoWidgetsTarget = transformExpoWidgetsTarget;
