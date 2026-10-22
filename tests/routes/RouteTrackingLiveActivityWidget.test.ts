import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

const widgetFilePath = path.resolve(
  __dirname,
  '../../src/features/location/liveActivity/RouteTrackingLiveActivityWidget.tsx',
);

const widgetSource = readFileSync(widgetFilePath, 'utf8');
const widgetSourceFile = ts.createSourceFile(
  widgetFilePath,
  widgetSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

describe('RouteTrackingLiveActivity widget runtime', () => {
  it('keeps runtime imports within the Expo widget component contract', () => {
    const allowedRuntimeModules = new Set([
      '@expo/ui/swift-ui',
      '@expo/ui/swift-ui/modifiers',
      'expo-widgets',
    ]);
    const runtimeImports = widgetSourceFile.statements
      .filter(ts.isImportDeclaration)
      .filter((declaration) => declaration.importClause && !declaration.importClause.isTypeOnly);
    const unsupportedRuntimeImports = runtimeImports
      .map((declaration) => (declaration.moduleSpecifier as ts.StringLiteral).text)
      .filter((moduleName) => !allowedRuntimeModules.has(moduleName));

    expect(unsupportedRuntimeImports).toEqual([]);
  });

  it('defines its formatting and timer helpers inside the isolated widget function', () => {
    const widgetComponent = widgetSourceFile.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === 'RouteTrackingLiveActivity',
    );
    const localHelperNames = widgetComponent?.body?.statements
      .filter(ts.isFunctionDeclaration)
      .map((declaration) => declaration.name?.text);

    expect(localHelperNames).toEqual(
      expect.arrayContaining(['formatRouteTrackingKilometers', 'getRouteTrackingTimerInterval']),
    );
  });
});
