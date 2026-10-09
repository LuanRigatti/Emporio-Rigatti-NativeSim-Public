import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Open Payments native Peek & Pop integration', () => {
  const screen = readSource('src/features/open-payments/components/OpenPaymentClientsScreen.tsx');
  const rootLayout = readSource('src/app/_layout.tsx');
  const cards = readSource('src/features/open-payments/components/OpenPaymentClientCards.tsx');
  const previewBuilder = readSource('src/features/open-payments/data/openPaymentNativePreview.ts');
  const previewTypes = readSource(
    'modules/native-card-context-menu/src/NativeContextMenuPreview.types.ts',
  );
  const nativeCard = readSource(
    'src/features/open-payments/components/OpenPaymentClientContextMenu.ios.tsx',
  );
  const fallbackCard = readSource(
    'src/features/open-payments/components/OpenPaymentClientContextMenu.tsx',
  );
  const coordinator = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewCoordinator.swift',
  );
  const nativeTrigger = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewView.swift',
  );
  const host = readSource(
    'modules/native-card-context-menu/ios/NativeOpenPaymentContextMenuHostView.swift',
  );
  const previewController = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewViewController.swift',
  );
  const hostModule = readSource(
    'modules/native-card-context-menu/ios/NativeOpenPaymentContextMenuHostModule.swift',
  );
  const moduleConfig = readSource('modules/native-card-context-menu/expo-module.config.json');
  const lab = readSource('modules/native-card-context-menu/ios/NativePeekPopPreviewLabView.swift');
  const labRoute = readSource('src/app/peek-pop-lab.tsx');
  const podspec = readSource('modules/native-card-context-menu/ios/NativeCardContextMenu.podspec');

  it('mounts one screen-level host and binds native preview cards only to the focused route', () => {
    expect(screen.match(/<NativeOpenPaymentContextMenuHostView/g)).toHaveLength(1);
    expect(screen).toContain('active={isFocused}');
    expect(screen).toContain('nativePeekPopEnabled={nativeHeader}');
    expect(cards).toContain('getOpenPaymentClientPreviewIdentifier(client)');
    expect(cards).toContain('buildOpenPaymentNativePreview(client');
    expect(nativeTrigger).toContain('commitBehavior: .pushPreviewController');
    expect(nativeTrigger).toContain('nearestPresentationHost()?.navigationControllerForPreview()');
  });

  it('preserves exact payment action IDs and forwards native action events to the existing callback', () => {
    expect(cards).toContain('id: `complete-payment-${delivery.id}`');
    expect(cards).toContain('onPress: () => onMarkAsPaid(delivery.id)');
    expect(cards).toContain('disabled: testModeEnabled');
    expect(nativeCard).toContain('event.nativeEvent.actionId');
    expect(nativeCard).toContain('actionsById.get(event.nativeEvent.actionId)?.onPress()');
  });

  it('keeps the current @expo/ui menu when UIKit host modules are unavailable', () => {
    expect(nativeCard).toContain("requireOptionalNativeModule('NativeContextMenuPreview')");
    expect(nativeCard).toContain("requireOptionalNativeModule('NativeOpenPaymentContextMenuHost')");
    expect(nativeCard).toContain('<NativeCardContextMenu actions={actions}');
    expect(fallbackCard).toContain('<NativeCardContextMenu');
    expect(hostModule).toContain('Prop("active")');
    expect(moduleConfig).toContain('NativeOpenPaymentContextMenuHostModule');
  });

  it('ties the one sibling navigation controller to route focus and teardown lifecycle', () => {
    expect(host).toContain('private var navigationController: UINavigationController?');
    expect(host).toContain('override func didMoveToWindow()');
    expect(host).toContain('pendingDeactivation = false');
    expect(host).toContain('scheduleDeactivationAfterTransition(transitionCoordinator)');
    expect(host).toContain('private func completePendingDeactivation()');
    expect(host).toContain('pendingDeactivation');
    expect(host).toContain('pendingTeardown');
    expect(host).toContain('didShow viewController: UIViewController');
    expect(host).toContain('navigationController.removeFromParent()');
    expect(host).toContain('private weak var hostViewController: UIViewController?');
  });

  it('preserves the native route back button and routes it to the list while the preview is expanded', () => {
    const openPaymentsRoute = rootLayout.match(
      /<Stack\.Screen\s+name="em-aberto"[\s\S]*?<\/Stack\.Screen>/,
    )?.[0];
    const commitPreparation = host.match(
      /func prepareForPreviewCommit\([\s\S]*?\n  }\n\n  func previewCommitDidComplete/,
    )?.[0];
    const returnDelegate = host.match(
      /public func navigationController\([\s\S]*?\n  }\n\n  private func installNavigationControllerIfNeeded/,
    )?.[0];
    const teardown = host.match(
      /private func tearDownNavigationController\([\s\S]*?\n  }\n\n  private func installSourceBackActionForExpandedPreview/,
    )?.[0];

    expect(openPaymentsRoute).toContain('headerShown: true');
    expect(openPaymentsRoute).toContain('<Stack.Screen.BackButton displayMode="minimal" />');
    expect(commitPreparation).toContain('installSourceBackActionForExpandedPreview()');
    expect(commitPreparation).toContain(
      'navigationController.navigationBar.prefersLargeTitles = true',
    );
    expect(commitPreparation).toContain(
      'previewController.prepareForExpandedPagePresentation(in: navigationController)',
    );
    expect(commitPreparation).toContain(
      'previewController.navigationItem.setHidesBackButton(true, animated: false)',
    );
    expect(host).toContain('hostViewController.navigationItem.backAction = UIAction');
    expect(host).toContain('self?.popExpandedPreviewToList()');
    expect(host).toContain('navigationController.popToRootViewController(animated: true)');
    expect(host).toContain('sourceBackDismissalInProgress');
    expect(host).toContain('originalSourceBackAction');
    expect(returnDelegate).toContain('viewController === rootViewController');
    expect(returnDelegate).toContain('restoreExpandedPreviewState()');
    expect(teardown).toContain('restoreExpandedPreviewState()');
    expect(host).toContain(
      'navigationController?.navigationBar.prefersLargeTitles = originalSiblingPrefersLargeTitles',
    );
    expect(host).toContain('navigationController?.navigationBar.largeTitleTextAttributes =');
    expect(host).toContain('expandedPreviewController?.restorePeekPresentation()');
    expect(host).toContain('navigationController.popToRootViewController(animated: false)');
    expect(host).toContain('if pendingTeardown || window == nil');
    expect(host).not.toContain('hostViewController.navigationItem.setHidesBackButton');
    expect(host).not.toContain('originalSourceBackButtonHidden');
    expect(podspec).toContain("s.platforms = { ios: '16.4' }");
    expect(previewController).toContain('navigationItem.largeTitleDisplayMode = .never');
    expect(previewController).toContain(
      'func prepareForExpandedPagePresentation(in navigationController: UINavigationController)',
    );
    expect(previewController).toContain('navigationItem.largeTitleDisplayMode = .always');
    expect(previewController).toContain('private static let previewCardCornerRadius: CGFloat = 28');
    expect(previewController).toContain(
      'private static let expandedCardCornerRadius: CGFloat = 34',
    );
    expect(previewController).toContain(
      'cardView.layer.cornerRadius = Self.expandedCardCornerRadius',
    );
    expect(previewController).toContain(
      'cardView.layer.cornerRadius = Self.previewCardCornerRadius',
    );
    expect(previewController).toContain('UIFont.systemFont(ofSize: 36, weight: .bold)');
    expect(previewController).toContain('UIFontMetrics(forTextStyle: .largeTitle).scaledFont(');
    expect(previewController).toContain('compatibleWith: traitCollection');
    expect(previewController).toContain('numberOfLines = 0');
    expect(previewController).toContain('adjustsFontForContentSizeCategory = true');
    expect(previewController).toContain('cardView.addSubview(contentStack)');
    expect(previewController).toContain('backgroundColor = .systemBackground');
    expect(previewController).toContain('view.backgroundColor = .secondarySystemGroupedBackground');
    expect(coordinator).toContain('previewController: previewController');
    expect(coordinator).toContain('animator.addAnimations { [presentationHost] in');
    expect(lab).not.toContain('presentationHostProvider');
  });

  it('commits the same preview controller with .pop and keeps both lab cards on their existing paths', () => {
    expect(coordinator).toContain('animator.preferredCommitStyle = .pop');
    expect(coordinator).toContain(
      'animator.previewViewController as? NativeContextMenuPreviewViewController',
    );
    expect(coordinator).toContain(
      'navigationController.pushViewController(previewController, animated: false)',
    );
    expect(coordinator).toContain('presentationHost?.prepareForPreviewCommit(');
    expect(coordinator).toContain('previewController: previewController');
    expect(coordinator).toContain(
      'presentationHost?.previewCommitDidComplete(in: navigationController)',
    );
    expect(lab).not.toContain('NativeOpenPaymentContextMenuHostView');
    expect(lab).toContain('commitBehavior: .pushPreviewController');
    expect(labRoute).toContain("presentationStyle: 'interactiveViewer'");
    expect(labRoute).toContain('identifier="settings-peek-pop-sample-client"');
  });

  it('passes resolved app colors only to the open-payment expanded preview', () => {
    expect(cards).toContain('getCardSurfaceColor(resolvedMode, theme.colors.surface)');
    expect(cards).toContain('cardSurfaceColor: openPaymentCardSurface');
    expect(cards).toContain('pageBackgroundColor: theme.colors.background');
    expect(previewBuilder).toContain('appearance: { cardSurfaceColor, pageBackgroundColor }');
    expect(previewTypes).toContain('appearance?: {');
    expect(previewTypes).toContain('pageBackgroundColor?: string');
    expect(previewTypes).toContain('cardSurfaceColor?: string');

    const expandedPagePreparation =
      previewController.match(/func prepareForExpandedPagePresentation\([\s\S]*?\n  }/)?.[0] ?? '';
    expect(expandedPagePreparation).toContain('guard presentationStyle == .page else { return }');
    expect(expandedPagePreparation).toContain('applyThemeAppearanceIfPresent');
    expect(expandedPagePreparation).toContain('updateExpandedPageLargeTitleAppearance');
    expect(expandedPagePreparation.indexOf('applyThemeAppearanceIfPresent')).toBeLessThan(
      expandedPagePreparation.indexOf('updateExpandedPageLargeTitleAppearance'),
    );
    expect(previewController).toContain('view.backgroundColor = .secondarySystemGroupedBackground');
    expect(previewController).toContain('cardView.backgroundColor = .systemBackground');
    expect(previewController).toContain('private func restoreThemeAppearance()');
    expect(previewController).toContain(
      'func updateExpandedPageThemeAppearance(_ appearance: [String: Any]?)',
    );
    expect(previewController).toContain('guard let hex = value as? String');
    expect(previewController).toContain(
      'guard pageColor != nil || cardColor != nil else { return }',
    );
    expect(previewController).toContain('navigationBar.standardAppearance = Self.copyAppearance');
    expect(previewController).toContain(
      'navigationBar.scrollEdgeAppearance = snapshot.scrollEdgeAppearance',
    );
    const compactPageLayout =
      previewController.match(/private func buildLayout\(\)[\s\S]*?\n  }/)?.[0] ?? '';
    expect(compactPageLayout).not.toContain('applyThemeAppearanceIfPresent');
    expect(compactPageLayout).toContain('view.backgroundColor = .secondarySystemGroupedBackground');
    expect(compactPageLayout).toContain('cardView.backgroundColor = .systemBackground');
    expect(labRoute).not.toContain('pageBackgroundColor:');
    expect(labRoute).not.toContain('cardSurfaceColor:');
    expect(coordinator).toContain('private weak var committedPreviewController');
    expect(coordinator).toContain('committedPreviewController?.updateExpandedPageThemeAppearance(');
    expect(coordinator).toContain('committedPreviewController = previewController');
  });
});
