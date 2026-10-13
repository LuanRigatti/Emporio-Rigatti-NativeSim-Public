const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const WIDGET_SOURCE_NAMES = ['ResumoFinanceiro.swift', 'EntregasDoDia.swift'];
const BRANDING_MARKER = '// ResumoFinanceiro shared branding image directory';
const ENVIRONMENT_ANCHOR =
  '    var env: [String: Any] = getWidgetEnvironment(environment: environment)';

function replaceExactlyOnce(source, anchor, replacement, label) {
  const matches = source.split(anchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      'ResumoFinanceiro branding CNG plugin expected exactly one ' +
        label +
        ' insertion point; found ' +
        matches +
        '. Check the expo-widgets generated Swift template before building.',
    );
  }

  return source.replace(anchor, replacement);
}

function transformResumoFinanceiroWidgetSource(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  if (transformed.includes(BRANDING_MARKER)) {
    if (!transformed.includes('env["widgetsDirectory"] =')) {
      throw new Error(
        'ResumoFinanceiro branding CNG plugin found a partial shared image path marker.',
      );
    }
    return source;
  }

  const importAnchor = 'import SwiftUI\n';
  transformed = replaceExactlyOnce(
    transformed,
    importAnchor,
    `${importAnchor}import Foundation\n${BRANDING_MARKER}\n`,
    'Foundation import',
  );

  const environmentInjection = [
    ENVIRONMENT_ANCHOR,
    '    if let appGroupIdentifier = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,',
    '      let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {',
    '      env["widgetsDirectory"] = appGroupContainer.appendingPathComponent("ExpoWidgets", isDirectory: true).absoluteString',
    '    }',
  ].join('\n');
  transformed = replaceExactlyOnce(
    transformed,
    ENVIRONMENT_ANCHOR,
    environmentInjection,
    'shared image directory',
  );

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function transformExpoWidgetsTarget(projectRoot) {
  const targetDirectory = path.join(projectRoot, 'ExpoWidgetsTarget');

  for (const widgetSourceName of WIDGET_SOURCE_NAMES) {
    const widgetSourcePath = path.join(targetDirectory, widgetSourceName);
    if (!fs.existsSync(widgetSourcePath)) {
      throw new Error(
        'ResumoFinanceiro branding CNG plugin could not find ' +
          widgetSourcePath +
          '. Ensure expo-widgets generates every configured widget before this plugin runs.',
      );
    }

    const originalSource = fs.readFileSync(widgetSourcePath, 'utf8');
    const transformedSource = transformResumoFinanceiroWidgetSource(originalSource);
    if (transformedSource !== originalSource) {
      fs.writeFileSync(widgetSourcePath, transformedSource);
    }
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
module.exports.transformResumoFinanceiroWidgetSource = transformResumoFinanceiroWidgetSource;
module.exports.transformExpoWidgetsTarget = transformExpoWidgetsTarget;
