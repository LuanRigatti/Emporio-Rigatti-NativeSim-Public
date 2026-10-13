const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

const WIDGET_SOURCE_NAME = 'ResumoFinanceiro.swift';
const IOS_17_DECLARATIONS = [
  'struct ResumoFinanceiroConfigurationAppIntent: WidgetConfigurationIntent {',
  'enum ResumoFinanceiroModeEnum: String, CaseIterable, AppEnum {',
  'struct ResumoFinanceiroTimelineEntry: TimelineEntry {',
  'struct ResumoFinanceiroTimelineProvider: AppIntentTimelineProvider {',
  'struct ResumoFinanceiroEntryView: View {',
];

function replaceExactlyOnce(source, anchor, replacement, label) {
  const matches = source.split(anchor).length - 1;
  if (matches !== 1) {
    throw new Error(
      `ResumoFinanceiro availability CNG plugin expected exactly one ${label} insertion point; found ${matches}. ` +
        'Check the expo-widgets generated Swift template before building.',
    );
  }

  return source.replace(anchor, replacement);
}

function transformResumoFinanceiroWidgetAvailability(source) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let transformed = source.replace(/\r\n/g, '\n');

  for (const declaration of IOS_17_DECLARATIONS) {
    const annotatedDeclaration = `@available(iOS 17.0, *)\n${declaration}`;
    const declarationCount = transformed.split(declaration).length - 1;
    if (declarationCount !== 1) {
      throw new Error(
        `ResumoFinanceiro availability CNG plugin expected exactly one declaration ${declaration}; found ${declarationCount}. ` +
          'Check the expo-widgets generated Swift template before building.',
      );
    }

    if (transformed.includes(annotatedDeclaration)) {
      continue;
    }

    transformed = replaceExactlyOnce(
      transformed,
      declaration,
      annotatedDeclaration,
      `iOS 17 availability for ${declaration.split(' ').slice(1, 3).join(' ')}`,
    );
  }

  return newline === '\n' ? transformed : transformed.replace(/\n/g, newline);
}

function withResumoFinanceiroAvailability(config) {
  return withDangerousMod(config, [
    'ios',
    async (configWithIos) => {
      const projectRoot = configWithIos.modRequest.platformProjectRoot;
      const widgetSourcePath = path.join(projectRoot, 'ExpoWidgetsTarget', WIDGET_SOURCE_NAME);

      if (!fs.existsSync(widgetSourcePath)) {
        throw new Error(
          `ResumoFinanceiro availability CNG plugin could not find ${widgetSourcePath}. ` +
            'Ensure expo-widgets generates its target before this plugin runs.',
        );
      }

      const originalSource = fs.readFileSync(widgetSourcePath, 'utf8');
      const compatibleSource = transformResumoFinanceiroWidgetAvailability(originalSource);
      if (compatibleSource !== originalSource) {
        fs.writeFileSync(widgetSourcePath, compatibleSource);
      }

      return configWithIos;
    },
  ]);
}

module.exports = withResumoFinanceiroAvailability;
module.exports.transformResumoFinanceiroWidgetAvailability =
  transformResumoFinanceiroWidgetAvailability;
