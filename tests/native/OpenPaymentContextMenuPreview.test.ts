import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Open Payments native context menu preview', () => {
  const screen = readSource('src/features/open-payments/components/OpenPaymentClientsScreen.tsx');
  const rootLayout = readSource('src/app/_layout.tsx');
  const cards = readSource('src/features/open-payments/components/OpenPaymentClientCards.tsx');
  const previewBuilder = readSource('src/features/open-payments/data/openPaymentNativePreview.ts');
  const nativeCard = readSource(
    'src/features/open-payments/components/OpenPaymentClientContextMenu.ios.tsx',
  );
  const coordinator = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewCoordinator.swift',
  );
  const nativeTrigger = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewView.swift',
  );
  const previewController = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewViewController.swift',
  );
  const nativeModule = readSource(
    'modules/native-card-context-menu/ios/NativeContextMenuPreviewModule.swift',
  );
  const moduleConfig = readSource('modules/native-card-context-menu/expo-module.config.json');
  const lab = readSource('modules/native-card-context-menu/ios/NativePeekPopPreviewLabView.swift');
  const labRoute = readSource('src/app/peek-pop-lab.tsx');
  const hostFiles = [
    'modules/native-card-context-menu/ios/NativeOpenPaymentContextMenuHostView.swift',
    'modules/native-card-context-menu/ios/NativeOpenPaymentContextMenuHostModule.swift',
    'modules/native-card-context-menu/src/NativeOpenPaymentContextMenuHostView.ios.tsx',
    'modules/native-card-context-menu/src/NativeOpenPaymentContextMenuHostView.tsx',
  ];

  it('keeps the Open Payments route swipe enabled without an expansion host or dynamic gesture state', () => {
    const openPaymentsRoute = rootLayout.match(
      /<Stack\.Screen\s+name="em-aberto"[\s\S]*?<\/Stack\.Screen>/,
    )?.[0];

    expect(openPaymentsRoute).toContain('gestureEnabled: true');
    expect(screen).toContain('<ProgressiveCollapsibleScreen');
    expect(screen).toContain('nativePreviewEnabled={nativeHeader}');
    expect(screen).not.toContain('gestureEnabled');
    expect(screen).not.toContain('isExpandedPeekPopOpen');
    expect(screen).not.toContain('NativeOpenPaymentContextMenuHostView');
    expect(moduleConfig).not.toContain('NativeOpenPaymentContextMenuHostModule');
    expect(hostFiles.every((path) => !existsSync(resolve(process.cwd(), path)))).toBe(true);
  });

  it('dismisses the native context menu when the payment preview is tapped', () => {
    const dismissBranch = coordinator.match(
      /case \.dismissPreview:[\s\S]*?case \.callback, \.pushPreviewController:/,
    )?.[0];

    expect(nativeCard).toContain("requireOptionalNativeModule('NativeContextMenuPreview')");
    expect(nativeCard).toContain('presentationStyle="page"');
    expect(nativeTrigger).toContain('commitBehavior: .dismissPreview');
    expect(nativeModule).toContain('Events("onAction")');
    expect(dismissBranch).toContain('animator.preferredCommitStyle = .dismiss');
    expect(dismissBranch).toContain('return');
    expect(dismissBranch).not.toContain('pushViewController');
    expect(nativeTrigger).not.toContain('navigationControllerProvider');
    expect(nativeTrigger).not.toContain('onOpen');
  });

  it('preserves the native payment preview content, theme, and Pago action', () => {
    expect(cards).toContain('id: `complete-payment-${delivery.id}`');
    expect(cards).toContain("? 'Pago'");
    expect(cards).toContain('onPress: () => onMarkAsPaid(delivery.id)');
    expect(cards).toContain('disabled: testModeEnabled');
    expect(nativeCard).toContain('actionsById.get(event.nativeEvent.actionId)?.onPress()');
    expect(previewBuilder).toContain("label: 'Saldo em aberto'");
    expect(previewBuilder).toContain("title: 'Últimos pagamentos'");
    expect(previewBuilder).toContain('formatCurrency(payment.valor)');
    expect(previewBuilder).toContain('appearance: { cardSurfaceColor, pageBackgroundColor }');
    expect(previewController).toContain('private static let previewCardCornerRadius: CGFloat = 28');
    expect(previewController).toContain('applyPreviewAppearance()');
    expect(previewController).toContain('content["sections"]');
  });

  it('preserves the laboratory push and interactive viewer paths', () => {
    expect(coordinator).toContain('animator.preferredCommitStyle = .pop');
    expect(coordinator).toContain(
      'navigationController.pushViewController(previewController, animated: false)',
    );
    expect(lab).toContain('commitBehavior: .pushPreviewController');
    expect(lab).toContain('.interactiveViewer');
    expect(labRoute).toContain("presentationStyle: 'interactiveViewer'");
    expect(labRoute).toContain('identifier="settings-peek-pop-sample-client"');
  });
});
