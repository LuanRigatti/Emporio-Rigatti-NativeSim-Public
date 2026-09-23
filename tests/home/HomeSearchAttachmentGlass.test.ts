import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Home search attachment Liquid Glass controls', () => {
  it('forwards the opt-in tint to the native GlassView without changing fallback material', () => {
    const glassSource = readSource('src/features/home/components/chatgpt-attachments/glass.tsx');

    expect(glassSource).toContain('tintColor?: string;');
    expect(glassSource).toContain('tintColor={tintColor}');
    expect(glassSource).toContain('fallbackTint ??');
  });

  it('uses the shared dark translucent tint for white-foreground controls only', () => {
    const constantsSource = readSource(
      'src/features/home/components/chatgpt-attachments/constants.ts',
    );
    const calendarSource = readSource(
      'src/features/home/components/HomeSearchAttachmentsComposer.tsx',
    );
    const sheetBarSource = readSource(
      'src/features/home/components/chatgpt-attachments/panel/sheet-bar.tsx',
    );
    const photoBarSource = readSource(
      'src/features/home/components/chatgpt-attachments/photos/photo-grid-bar.tsx',
    );
    const cameraBarSource = readSource(
      'src/features/home/components/chatgpt-attachments/camera/camera-bar.tsx',
    );
    const panelSource = readSource(
      'src/features/home/components/chatgpt-attachments/panel/attachment-panel.tsx',
    );
    const menuSource = readSource(
      'src/features/home/components/chatgpt-attachments/panel/attachment-menu.tsx',
    );
    const calendarGridSource = readSource(
      'src/features/home/components/chatgpt-attachments/panel/local-calendar.tsx',
    );
    const composerSource = readSource(
      'src/features/home/components/chatgpt-attachments/composer/composer.tsx',
    );
    const tintProp = 'tintColor={ATTACHMENT_CONTROL_GLASS_TINT}';
    const fallbackTintProp = 'fallbackTint={ATTACHMENT_CONTROL_GLASS_TINT}';
    const tint = 'rgba(0, 0, 0, 0.72)';

    expect(constantsSource).toContain(`ATTACHMENT_CONTROL_GLASS_TINT = '${tint}'`);
    for (const source of [calendarSource, sheetBarSource, photoBarSource, cameraBarSource]) {
      expect(source).toContain(tintProp);
      expect(source).toContain(fallbackTintProp);
      expect(source).not.toContain('registrarDeliveryDarkLiquidGlassTint');
    }
    expect(
      cameraBarSource.match(/tintColor=\{ATTACHMENT_CONTROL_GLASS_TINT\}/g) ?? [],
    ).toHaveLength(3);
    expect(sheetBarSource).toContain('color={COLORS.text}');
    expect(calendarSource).toContain('color: COLORS.text');
    expect(photoBarSource).toContain('color: COLORS.text');
    expect(photoBarSource).toContain('backgroundColor: ATTACHMENT_CONTROL_GLASS_TINT');
    expect(cameraBarSource).toContain('color={COLORS.text}');
    expect(calendarSource).toContain('onPress={handleCalendarConfirmPress}');
    expect(sheetBarSource).toContain('onPress={onBack}');
    expect(cameraBarSource).toContain('onPress={onCapture}');
    expect(cameraBarSource).toContain('onPress={onToggleFlash}');
    expect(cameraBarSource).toContain('onPress={onFlip}');
    expect(cameraBarSource).toContain('onPress={toggleOptions}');
    expect(photoBarSource).toContain('onPress={onConfirm}');
    expect(photoBarSource).toContain('onBack={onBack}');
    expect(menuSource).toContain("action: 'files'");
    expect(menuSource).toContain('onPress={() => onSelect(item.action)}');

    expect(panelSource).not.toContain('registrarDeliveryDarkLiquidGlassTint');
    expect(panelSource).not.toContain('ATTACHMENT_CONTROL_GLASS_TINT');
    expect(menuSource).not.toContain('<Glass');
    expect(menuSource).not.toContain('ATTACHMENT_CONTROL_GLASS_TINT');
    expect(calendarGridSource).not.toContain('ATTACHMENT_CONTROL_GLASS_TINT');
    expect(composerSource).not.toContain('ATTACHMENT_CONTROL_GLASS_TINT');
  });

  it('uses shared footnote typography for the removable temporal composer chip', () => {
    const composerSource = readSource(
      'src/features/home/components/chatgpt-attachments/composer/composer.tsx',
    );

    expect(composerSource).toContain('theme.typography.footnote');
    expect(composerSource).toContain('fontSize: theme.typography.footnote.fontSize + 1');
    expect(composerSource).toContain('height: COMPOSER.dateChipHeight');
    expect(composerSource).toContain('formatLocalDateAttachmentCompact(date)');
    expect(composerSource).toContain('formatLocalDateAttachment(date)');
    expect(composerSource).toContain('accessibilityLabel={accessibilityDate}');
    expect(composerSource).toContain('accessibilityLabel={`Remover data ${accessibilityDate}`}');
  });
});
