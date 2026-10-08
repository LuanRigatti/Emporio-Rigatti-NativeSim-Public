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
  const dismissCoordinator = readSource(
    'modules/native-card-context-menu/ios/NativePeekPopInteractiveDismissCoordinator.swift',
  );
  const labView = readSource(
    'modules/native-card-context-menu/ios/NativePeekPopPreviewLabView.swift',
  );
  const moduleConfig = readSource('modules/native-card-context-menu/expo-module.config.json');
  const podspec = readSource('modules/native-card-context-menu/ios/NativeCardContextMenu.podspec');
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
    expect(podspec).toContain("s.source_files = '**/*.{h,m,mm,swift}'");
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
    expect(coordinator).toContain('NativeContextMenuPreviewViewController(');
    expect(coordinator).toContain('content: content');
    expect(coordinator).toContain('presentationStyle: style');
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

  it('preserves the first card and opens the second in a sibling viewer navigation container', () => {
    expect(coordinator).toContain(
      'var presentationStyle: NativeContextMenuPreviewPresentationStyle = .page',
    );
    expect(publicTypes).toContain("'page' | 'expandedPanel' | 'interactiveViewer'");
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
    const firstCardProps = route
      .split('<NativePeekPopPreviewLabView')[1]
      ?.split('secondaryCard={{')[0];
    expect(firstCardProps).toBeDefined();
    expect(firstCardProps).toContain('identifier="settings-peek-pop-sample-client"');
    expect(firstCardProps).toContain('preview={preview}');
    expect(firstCardProps).toContain('actions={actions}');
    expect(firstCardProps).not.toContain('presentationStyle');
    expect(route).toContain("presentationStyle: 'interactiveViewer'");
    expect(route).toContain("title: 'Prévia → Painel expandido'");
    expect(route).toContain("title: 'Pago'");

    const viewerLayout = previewController
      .split('private func buildInteractiveViewerLayout()')[1]
      ?.split('private func installInteractiveDismissCoordinatorIfNeeded()')[0];
    expect(viewerLayout).toBeDefined();
    expect(viewerLayout).toContain('view.safeAreaLayoutGuide');
    expect(viewerLayout).toContain('view.backgroundColor = .clear');
    expect(viewerLayout).toContain('viewerSurfaceView.backgroundColor = .systemBackground');
    expect(viewerLayout).toContain(
      'viewerSurfaceView.topAnchor.constraint(equalTo: safeArea.topAnchor)',
    );
    expect(viewerLayout).toContain(
      'viewerSurfaceView.bottomAnchor.constraint(equalTo: view.bottomAnchor)',
    );
    expect(viewerLayout).toContain(
      'viewerSurfaceView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]',
    );
    expect(viewerLayout).toContain(
      'scrollView.bottomAnchor.constraint(equalTo: viewerSurfaceView.bottomAnchor)',
    );
    expect(viewerLayout).toContain(
      'contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)',
    );
    expect(viewerLayout).not.toContain('cardView');
    expect(viewerLayout).not.toContain('0.82');
    expect(previewController).toContain(
      'if usesInteractiveViewer {\n      container.backgroundColor = .clear',
    );
    expect(previewController).not.toContain('UISheetPresentationController');
    expect(previewController).not.toContain('present(');

    expect(labView).toContain('hostViewController.addChild(navigationController)');
    expect(labView).toContain('hostViewController.addChild(interactiveNavigationController)');
    expect(labView).toContain('interactiveNavigationController.view.backgroundColor = .clear');
    expect(labView).toContain(
      'interactiveNavigationController.view.isUserInteractionEnabled = false',
    );
    expect(labView).toContain('rootView.backgroundColor = .clear');
    expect(labView).toContain('return style == .interactiveViewer');
    expect(labView).toContain('? self.interactiveNavigationControllerProvider()');
    expect(labView).toContain(': self.navigationController');
    expect(labView).toContain('interactiveNavigationControllerProvider: { [weak self] in');
    expect(labView).toContain('self?.interactiveNavigationController');
    expect(labView).toContain('self.interactiveNavigationControllerProvider()');
    expect(labView).toContain('interactiveNavigationController = nil');
    expect(coordinator).toContain(
      'previewController.prepareForInteractiveViewer(in: navigationController)',
    );
    expect(coordinator).toContain(
      'navigationController.pushViewController(previewController, animated: false)',
    );
  });

  it('drives vertical dismissal through an interactive UIKit navigation pop', () => {
    expect(dismissCoordinator).toContain('UIPanGestureRecognizer(');
    expect(dismissCoordinator).toContain(
      'scrollView.panGestureRecognizer.require(toFail: panGesture)',
    );
    expect(dismissCoordinator).toContain('gestureRecognizerShouldBegin');
    expect(dismissCoordinator).toContain('scrollViewIsAtTop');
    expect(dismissCoordinator).toContain('UIPercentDrivenInteractiveTransition()');
    expect(dismissCoordinator).toContain('navigationController.popViewController(animated: true)');
    expect(dismissCoordinator).toContain('interactionController?.update(progress)');
    expect(dismissCoordinator).toContain('interactionController?.finish()');
    expect(dismissCoordinator).toContain('interactionController?.cancel()');
    expect(dismissCoordinator).toContain('transitionContext.transitionWasCancelled');
    expect(dismissCoordinator).toContain('fromView.frame = startFrame');
    expect(dismissCoordinator).toContain('transitionContext.completeTransition(completed)');
    expect(dismissCoordinator).toContain('navigationController.delegate = self');
    expect(dismissCoordinator).toContain('navigationController.delegate = nil');
    expect(dismissCoordinator).toContain('gestureView.addGestureRecognizer(panGesture)');
    expect(dismissCoordinator).toContain('gestureView?.removeGestureRecognizer($0)');
    expect(dismissCoordinator).toContain(
      'sourceView.convert(sourceView.bounds, to: containerView)',
    );
    expect(dismissCoordinator).not.toContain('sourceCenterX');
    expect(dismissCoordinator).toContain(
      'navigationController.view.isUserInteractionEnabled = false',
    );
    expect(coordinator).toContain(
      'previewController.prepareForInteractiveViewer(in: navigationController)',
    );
    expect(previewController).toContain('installInteractiveDismissCoordinatorIfNeeded()');
    expect(dismissCoordinator).toContain(
      'sourceView.convert(sourceView.bounds, to: containerView)',
    );
    expect(dismissCoordinator).toContain('fromView.layer.cornerRadius = reduceMotion ? 0 : 32');
    expect(dismissCoordinator).toContain('UIAccessibility.isReduceMotionEnabled');
    expect(dismissCoordinator).not.toContain('present(');
    expect(dismissCoordinator).not.toContain('UISheetPresentationController');
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
    expect(route).toContain("presentationStyle: 'interactiveViewer'");
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
