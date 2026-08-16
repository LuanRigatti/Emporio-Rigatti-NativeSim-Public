const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'ui',
  'ios',
  'BottomSheetView.swift'
);

function applyPatch() {
  if (!fs.existsSync(targetFile)) {
    console.warn('[patch-expo-ui] BottomSheetView.swift not found in node_modules.');
    process.exit(1);
  }

  let content = fs.readFileSync(targetFile, 'utf8');

  if (content.includes('.ignoresSafeArea(.container, edges: .bottom)')) {
    console.log('[patch-expo-ui] BottomSheetView.swift is already patched with .ignoresSafeArea.');
    return;
  }

  const targetPattern = /sheetContent\s*\n/g;
  const match = content.match(targetPattern);

  if (!match) {
    console.error('[patch-expo-ui] ERROR: Target sheetContent block not found in BottomSheetView.swift.');
    process.exit(1);
  }

  const updatedContent = content.replace(
    /(\.sheet\(isPresented:\s*\$isPresented,\s*onDismiss:\s*\{[\s\S]*?\}\)\s*\{\s*\n\s*sheetContent)(\s*\n)/,
    `$1\n          .ignoresSafeArea(.container, edges: .bottom)$2`
  );

  if (updatedContent === content) {
    // Fallback exact replace
    const exactTarget = `      .sheet(isPresented: $isPresented, onDismiss: {\n        props.onDismiss()\n      }) {\n        sheetContent\n      }`;
    const exactReplacement = `      .sheet(isPresented: $isPresented, onDismiss: {\n        props.onDismiss()\n      }) {\n        sheetContent\n          .ignoresSafeArea(.container, edges: .bottom)\n      }`;
    const fallbackUpdated = content.replace(exactTarget, exactReplacement);

    if (fallbackUpdated === content) {
      console.error('[patch-expo-ui] ERROR: Could not apply patch to BottomSheetView.swift.');
      process.exit(1);
    }

    fs.writeFileSync(targetFile, fallbackUpdated, 'utf8');
  } else {
    fs.writeFileSync(targetFile, updatedContent, 'utf8');
  }

  // Verification
  const verifyContent = fs.readFileSync(targetFile, 'utf8');
  if (!verifyContent.includes('.ignoresSafeArea(.container, edges: .bottom)')) {
    console.error('[patch-expo-ui] ERROR: Verification failed. BottomSheetView.swift does not contain the patch.');
    process.exit(1);
  }

  console.log('[patch-expo-ui] Successfully patched BottomSheetView.swift with .ignoresSafeArea(.container, edges: .bottom).');
}

applyPatch();

