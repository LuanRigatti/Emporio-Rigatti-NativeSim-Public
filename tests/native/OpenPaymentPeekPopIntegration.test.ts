import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Open Payments native Peek & Pop integration', () => {
  const screen = readSource('src/features/open-payments/components/OpenPaymentClientsScreen.tsx');
  const cards = readSource('src/features/open-payments/components/OpenPaymentClientCards.tsx');
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
  const hostModule = readSource(
    'modules/native-card-context-menu/ios/NativeOpenPaymentContextMenuHostModule.swift',
  );
  const moduleConfig = readSource('modules/native-card-context-menu/expo-module.config.json');
  const lab = readSource('modules/native-card-context-menu/ios/NativePeekPopPreviewLabView.swift');
  const labRoute = readSource('src/app/peek-pop-lab.tsx');

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

  it('commits the same preview controller with .pop and keeps both lab cards on their existing paths', () => {
    expect(coordinator).toContain('animator.preferredCommitStyle = .pop');
    expect(coordinator).toContain(
      'animator.previewViewController as? NativeContextMenuPreviewViewController',
    );
    expect(coordinator).toContain(
      'navigationController.pushViewController(previewController, animated: false)',
    );
    expect(coordinator).toContain(
      'presentationHost?.prepareForPreviewCommit(in: navigationController)',
    );
    expect(coordinator).toContain(
      'presentationHost?.previewCommitDidComplete(in: navigationController)',
    );
    expect(lab).not.toContain('NativeOpenPaymentContextMenuHostView');
    expect(lab).toContain('commitBehavior: .pushPreviewController');
    expect(labRoute).toContain("presentationStyle: 'interactiveViewer'");
    expect(labRoute).toContain('identifier="settings-peek-pop-sample-client"');
  });
});
