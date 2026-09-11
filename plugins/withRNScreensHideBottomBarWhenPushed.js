const fs = require('fs');
const path = require('path');
const { createRunOncePlugin, withDangerousMod } = require('expo/config-plugins');

const PATCH_MARKERS = {
  prop: 'Emporio Rigatti: hidesBottomBarWhenPushed prop',
  setter: 'Emporio Rigatti: hidesBottomBarWhenPushed setter',
  update: 'Emporio Rigatti: hidesBottomBarWhenPushed update',
};

function patchFile(filePath, needle, replacement, marker) {
  const contents = fs.readFileSync(filePath, 'utf8');

  if (contents.includes(marker)) return;

  if (!contents.includes(needle)) {
    throw new Error(`Não foi possível aplicar a integração de tab bar em ${filePath}.`);
  }

  fs.writeFileSync(filePath, contents.replace(needle, replacement));
}

function patchRNScreens() {
  const screensRoot = path.dirname(require.resolve('react-native-screens/package.json'));

  patchFile(
    path.join(screensRoot, 'src', 'fabric', 'ScreenNativeComponent.ts'),
    '  nativeBackButtonDismissalEnabled?: boolean | undefined;\n',
    `  nativeBackButtonDismissalEnabled?: boolean | undefined;\n  // ${PATCH_MARKERS.prop}\n  hidesBottomBarWhenPushed?: boolean | undefined;\n`,
    PATCH_MARKERS.prop,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreen.h'),
    '@property (nonatomic) BOOL gestureEnabled;\n',
    `@property (nonatomic) BOOL gestureEnabled;\n// ${PATCH_MARKERS.prop}\n@property (nonatomic) BOOL hidesBottomBarWhenPushed;\n`,
    PATCH_MARKERS.prop,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreen.mm'),
    `- (void)setReplaceAnimation:(RNSScreenReplaceAnimation)replaceAnimation\n{\n  _replaceAnimation = replaceAnimation;\n}\n`,
    `// ${PATCH_MARKERS.setter}\n- (void)setHidesBottomBarWhenPushed:(BOOL)hidesBottomBarWhenPushed\n{\n  _hidesBottomBarWhenPushed = hidesBottomBarWhenPushed;\n  _controller.hidesBottomBarWhenPushed = hidesBottomBarWhenPushed;\n}\n\n- (void)setReplaceAnimation:(RNSScreenReplaceAnimation)replaceAnimation\n{\n  _replaceAnimation = replaceAnimation;\n}\n`,
    PATCH_MARKERS.setter,
  );

  patchFile(
    path.join(screensRoot, 'ios', 'RNSScreen.mm'),
    '  [self setGestureEnabled:newScreenProps.gestureEnabled];\n',
    `  [self setGestureEnabled:newScreenProps.gestureEnabled];\n\n  // ${PATCH_MARKERS.update}\n  if (newScreenProps.hidesBottomBarWhenPushed != oldScreenProps.hidesBottomBarWhenPushed) {\n    [self setHidesBottomBarWhenPushed:newScreenProps.hidesBottomBarWhenPushed];\n  }\n`,
    PATCH_MARKERS.update,
  );
}

function withRNScreensHideBottomBarWhenPushed(config) {
  return withDangerousMod(config, [
    'ios',
    (configWithMod) => {
      patchRNScreens();
      return configWithMod;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withRNScreensHideBottomBarWhenPushed,
  'with-rnscreens-hide-bottom-bar-when-pushed',
  '1.0.0',
);
