import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('reusable native context menu preview', () => {
  const coordinator = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewCoordinator.swift',
  );
  const previewController = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewViewController.swift',
  );
  const labView = readSource(
    'modules/native-card-context-menu/ios/NativePeekPopPreviewLabView.swift',
  );
  const moduleConfig = readSource('modules/native-card-context-menu/expo-module.config.json');
  const publicTypes = readSource(
    'modules/native-card-context-menu/src/NativeContextMenuPreview.types.ts',
  );
  const genericComponent = readSource(
    'modules/native-card-context-menu/src/NativeContextMenuPreviewView.ios.tsx',
  );
  const nativeModule = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewModule.swift',
  );
  const labModule = readSource(
    'modules/native-card-context-menu/ios/NativePeekPopPreviewLabModule.swift',
  );
  const route = readSource('src/app/peek-pop-lab.tsx');
  const labModuleView = readSource(
    'modules/native-card-context-menu/ios/NativePeekPopPreviewLabView.swift',
  );
  const labFallback = readSource(
    'modules/native-card-context-menu/src/NativePeekPopPreviewLabView.tsx',
  );
  const rootLayout = readSource('src/app/_layout.tsx');
  const settings = readSource('src/features/settings/components/SettingsScreen.tsx');

  it('keeps the existing production module and registers isolated lab components', () => {
    expect(moduleConfig).toContain('NativeCardContextMenuModule');
    expect(moduleConfig).toContain('NativeContextMenuPreviewModule');
    expect(moduleConfig).toContain('NativePeekPopPreviewLabModule');
    expect(settings).not.toContain('__DEV__');
    expect(settings).toContain('title="Teste de prévia nativa"');
    expect(settings).toContain("router.push('/peek-pop-lab')");
    expect(rootLayout).toContain('name="peek-pop-lab"');
    expect(rootLayout).toContain('hidesBottomBarWhenPushed: true');
  });

  it('uses UIKit context menu configuration, a real preview controller, menu actions, and pop commit', () => {
    expect(coordinator).toContain('UIContextMenuInteractionDelegate');
    expect(coordinator).toContain('UIContextMenuConfiguration(');
    expect(coordinator).toContain('previewProvider:');
    expect(coordinator).toContain(
      'NativeContextMenuPreviewViewController(content: content, presentationStyle: style)',
    );
    expect(coordinator).toContain('UIMenu(');
    expect(coordinator).toContain('UIAction(');
    expect(coordinator).toContain('animator.preferredCommitStyle = .pop');
    expect(coordinator).toContain('animator.previewViewController');
    expect(coordinator).toContain('animator.addAnimations');
    expect(coordinator).toContain(
      'navigationController.pushViewController(previewController, animated: false)',
    );
    expect(coordinator).toContain('animator.preferredCommitStyle = .pop');
    expect(coordinator).toContain('animator.previewViewController');
    expect(previewController).toContain(
      'presentationStyle: NativeContextMenuPreviewPresentationStyle = .page',
    );
    expect(previewController).toContain('UIFontMetrics');
    expect(previewController).toContain('.systemBackground');
  });

  it('keeps the existing page presentation as the default and supports a UIKit expanded panel style', () => {
    expect(coordinator).toContain(
      'var presentationStyle: NativeContextMenuPreviewPresentationStyle = .page',
    );
    expect(publicTypes).toContain("'page' | 'expandedPanel'");
    expect(nativeModule).toContain('Prop("presentationStyle")');
    expect(previewController).toContain('if presentationStyle == .expandedPanel');
    expect(previewController).toContain('cardView.layer.cornerRadius = 32');
    expect(previewController).toContain(
      'cardView.centerYAnchor.constraint(equalTo: safeArea.centerYAnchor)',
    );
    expect(previewController).toContain(
      'cardView.heightAnchor.constraint(equalTo: safeArea.heightAnchor, multiplier: 0.82)',
    );
    expect(previewController).toContain(
      'cardView.widthAnchor.constraint(lessThanOrEqualToConstant: 640)',
    );
    expect(previewController).toContain('scrollView.contentLayoutGuide');
    expect(previewController).toContain('presentationStyle == .expandedPanel ? 560 : 460');
    expect(previewController).not.toContain('UISheetPresentationController');
    expect(previewController).not.toContain('present(');
  });

  it('supports TS-configured identity, preview content, actions, and open callbacks', () => {
    expect(publicTypes).toContain('identifier: string');
    expect(publicTypes).toContain('NativeContextMenuPreviewContent');
    expect(publicTypes).toContain('NativeContextMenuAction');
    expect(publicTypes).toContain('onAction?');
    expect(publicTypes).toContain('onOpen?');
    expect(publicTypes).toContain('secondaryCard?: NativePeekPopPreviewLabCard');
    expect(genericComponent).toContain("requireNativeView('NativeContextMenuPreview')");
    expect(nativeModule).toContain('Prop("identifier")');
    expect(nativeModule).toContain('Prop("preview")');
    expect(nativeModule).toContain('Prop("actions")');
    expect(nativeModule).toContain('Events("onAction", "onOpen")');
    expect(labModule).toContain('Events("onClose", "onAction", "onOpen")');
    expect(labModule).toContain('Prop("secondaryCard")');
    expect(labModuleView).toContain('var secondaryCard: [String: Any]?');
    expect(labFallback).toContain('secondaryCard: _secondaryCard');
    expect(coordinator).toContain('identifier: cardIdentifier as NSString');
    expect(coordinator).toContain('self?.onOpen?(cardIdentifier, content)');
    expect(previewController).toContain('content["sections"]');
  });

  it('uses only local sample data and an isolated UIKit navigation container in the lab', () => {
    expect(route).toContain('Cliente Exemplo');
    expect(route).toContain('R$ 306,00');
    expect(route).toContain("title: 'Pago'");
    expect(route).toContain("title: 'Prévia → Painel expandido'");
    expect(route).toContain("presentationStyle: 'expandedPanel'");
    expect(route).toContain("title: 'Informações adicionais'");
    expect(labView).toContain(
      'private var secondaryCoordinator: NativeContextMenuPreviewCoordinator?',
    );
    expect(labView).toContain('commitBehavior: .pushPreviewController');
    expect(labView).toContain('secondaryCardView');
    expect(labView).not.toContain('UISheetPresentationController');
    expect(labView).not.toContain('present(');
    expect(route).not.toContain('__DEV__');
    expect(route).not.toContain('Redirect');
    expect(route).toContain('Nenhum dado real foi alterado.');
    expect(route).not.toMatch(/firebase|Firestore|repository|datasource/i);
    expect(labView).toContain('hostViewController.addChild(navigationController)');
    expect(labView).toContain('commitBehavior: .pushPreviewController');
    expect(labView).toContain('self?.onClose(["identifier": identifier])');
  });
});
