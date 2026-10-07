import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const projectRoot = process.cwd();
const screensSourceRoot = join(projectRoot, 'node_modules', 'react-native-screens');
const fixtureFiles = [
  'src/fabric/ScreenNativeComponent.ts',
  'ios/RNSScreen.h',
  'ios/RNSScreen.mm',
  'ios/RNSScreenStack.mm',
  'ios/RNSScreenStackHeaderConfig.mm',
  'ios/tabs/host/RNSTabBarController.h',
  'ios/tabs/host/RNSTabBarController.mm',
];

function sectionBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate generated section: ${startMarker}`);
  }
  return source.slice(start, end);
}

describe('shared toolbar ownership config plugin', () => {
  let fixtureRoot = '';
  let generatedController = '';
  let generatedStack = '';
  let generatedHeaderConfig = '';
  let runDangerousMod: ((config: Record<string, unknown>) => Record<string, unknown>) | undefined;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'emporio-toolbar-plugin-'));
    const fixtureScreensRoot = join(fixtureRoot, 'node_modules', 'react-native-screens');

    for (const relativePath of fixtureFiles) {
      const destination = join(fixtureScreensRoot, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(screensSourceRoot, relativePath), destination);
    }

    writeFileSync(
      join(fixtureScreensRoot, 'package.json'),
      JSON.stringify({ name: 'react-native-screens', version: '4.26.2' }),
    );

    const configPluginsStub = join(fixtureRoot, 'config-plugins-stub.cjs');
    writeFileSync(
      configPluginsStub,
      [
        'exports.createRunOncePlugin = (plugin) => plugin;',
        'exports.withDangerousMod = (config, [platform, action]) => ({ ...config, __platform: platform, __action: action });',
      ].join('\n'),
    );

    const fixturePluginDirectory = join(fixtureRoot, 'plugins');
    mkdirSync(fixturePluginDirectory, { recursive: true });
    const fixturePluginPath = join(
      fixturePluginDirectory,
      'withRNScreensHideBottomBarWhenPushed.js',
    );
    const pluginSource = readFileSync(
      join(projectRoot, 'plugins', 'withRNScreensHideBottomBarWhenPushed.js'),
      'utf8',
    ).replace("require('expo/config-plugins')", `require(${JSON.stringify(configPluginsStub)})`);
    writeFileSync(fixturePluginPath, pluginSource);

    const fixtureRequire = createRequire(fixturePluginPath);
    const plugin = fixtureRequire(fixturePluginPath) as (
      config: Record<string, unknown>,
    ) => Record<string, unknown>;
    const configured = plugin({});
    runDangerousMod = configured.__action as typeof runDangerousMod;
    if (configured.__platform !== 'ios' || runDangerousMod === undefined) {
      throw new Error('The iOS dangerous mod was not registered by the config plugin.');
    }

    runDangerousMod(configured);

    generatedController = readFileSync(
      join(fixtureScreensRoot, 'ios', 'tabs', 'host', 'RNSTabBarController.mm'),
      'utf8',
    );
    generatedStack = readFileSync(join(fixtureScreensRoot, 'ios', 'RNSScreenStack.mm'), 'utf8');
    generatedHeaderConfig = readFileSync(
      join(fixtureScreensRoot, 'ios', 'RNSScreenStackHeaderConfig.mm'),
      'utf8',
    );
  });

  afterAll(() => {
    if (fixtureRoot !== '' && existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('retains materialized arrays and their original UIBarButtonItem instances per root', () => {
    const capture = sectionBetween(
      generatedController,
      '- (void)captureSharedToolbarItemsFromViewController:',
      '- (void)prepareSharedNavigationBarForViewController:',
    );

    expect(generatedController).toContain('RNSSharedToolbarMaterializedItemsKey');
    expect(capture).toContain('navigationController.viewControllers.count != 1');
    expect(capture).toContain(
      'NSDictionary *materialized = @{\@"left": item.leftBarButtonItems ?: @[], \@"right": item.rightBarButtonItems ?: @[]}',
    );
    expect(capture).toContain(
      'objc_setAssociatedObject(item, &RNSSharedToolbarMaterializedItemsKey, materialized, OBJC_ASSOCIATION_RETAIN_NONATOMIC)',
    );
    expect(capture).toContain('[item setLeftBarButtonItems:nil animated:NO]');
    expect(capture).toContain('[item setRightBarButtonItems:nil animated:NO]');
    expect(capture).not.toContain('copy');
  });

  it('keeps the nested root bar suppressed and the shared navigation controller as owner', () => {
    const rootPreparation = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason allowRootDestinationDuringTransition:',
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
    );

    expect(rootPreparation).toContain(
      'sharedNavigationController.topViewController != tabsScreenViewController',
    );
    expect(rootPreparation).toContain(
      'nestedNavigationController setNavigationBarHidden:YES animated:NO',
    );
    expect(rootPreparation).toContain(
      'sharedNavigationController.topViewController.navigationItem',
    );
    expect(rootPreparation).toContain('if (sharedNavigationController.navigationBarHidden)');
  });

  it('preserves tab-selection preparation before UIKit commits the selected index', () => {
    const setSelectedIndex = sectionBetween(
      generatedController,
      '- (void)setSelectedIndex:(NSUInteger)selectedIndex',
      '- (void)setSelectedViewController:',
    );

    expect(setSelectedIndex.indexOf('prepareSharedNavigationBarForViewController')).toBeLessThan(
      setSelectedIndex.indexOf('[super setSelectedIndex:selectedIndex]'),
    );
  });

  it('prepares a validated destination root in willShow despite an active transition', () => {
    const willShow = sectionBetween(
      generatedStack,
      '- (void)navigationController:(UINavigationController *)navigationController\n      willShowViewController:',
      '- (void)presentationControllerDidDismiss:',
    );
    const destinationHandoff = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
      '- (void)synchronizeSharedNavigationBarWithReason:',
    );
    const rootPreparation = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason allowRootDestinationDuringTransition:',
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
    );

    expect(willShow.indexOf('[RNSScreenStackHeaderConfig willShowViewController:')).toBeLessThan(
      willShow.indexOf('prepareSharedNavigationBarForWillShowDestinationViewController'),
    );
    expect(destinationHandoff).toContain('nestedNavigationController.viewControllers.count != 1');
    expect(destinationHandoff).toContain(
      'nestedNavigationController.topViewController != destinationViewController',
    );
    expect(destinationHandoff).toContain(
      'objc_getAssociatedObject(destinationViewController.navigationItem',
    );
    expect(destinationHandoff).toContain('self.selectedViewController != rootTabViewController');
    expect(destinationHandoff).toContain('allowRootDestinationDuringTransition:YES');
    expect(rootPreparation).toContain('hasActiveTransition');
    expect(rootPreparation).toContain(
      'allowRootDestinationDuringTransition && nestedNavigationController.viewControllers.count == 1',
    );
    expect(rootPreparation).toContain(
      'materializedItems = objc_getAssociatedObject(sourceNavigationItem',
    );
    expect(rootPreparation.indexOf('materializedItems = objc_getAssociatedObject')).toBeLessThan(
      rootPreparation.indexOf('Only a cached, validated root destination'),
    );
    expect(rootPreparation.indexOf('Only a cached, validated root destination')).toBeLessThan(
      rootPreparation.indexOf('nestedNavigationController setNavigationBarHidden:YES'),
    );
  });

  it('captures materialized root items before running generic header resync', () => {
    const synchronizationHelper = sectionBetween(
      generatedHeaderConfig,
      'static void RNSSynchronizeSharedTabToolbar(',
      '\n}',
    );

    expect(synchronizationHelper).toContain('if (didMaterialize)');
    expect(
      synchronizationHelper.indexOf('captureSharedToolbarItemsFromViewController'),
    ).toBeLessThan(synchronizationHelper.indexOf('synchronizeSharedNavigationBarWithReason'));
  });

  it('keeps generic synchronization blocked during transitions and limits didShow to reconciliation', () => {
    const genericRootSync = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason allowRootDestinationDuringTransition:',
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
    );
    const didShow = sectionBetween(
      generatedStack,
      '- (void)navigationController:(UINavigationController *)navigationController\n       didShowViewController:',
      '- (void)markChildUpdated',
    );

    expect(genericRootSync).toContain('if (!isTransitionCompletion && hasActiveTransition)');
    expect(genericRootSync).toContain('allowRootDestinationDuringTransition');
    expect(
      generatedStack.indexOf('prepareSharedNavigationBarForWillShowDestinationViewController'),
    ).toBeLessThan(generatedStack.indexOf('didShowViewController:'));
    expect(didShow).toContain('synchronizeSharedNavigationBarWithReason:@"navigation-did-show"');
  });

  it('delivers the same detached custom view once through UINavigationItem setters', () => {
    const rootPreparation = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason allowRootDestinationDuringTransition:',
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
    );

    expect(rootPreparation).toContain(
      'RNSSharedToolbarItemsNeedAttachment(leftItems, sharedNavigationController.navigationBar)',
    );
    expect(rootPreparation).toContain(
      'RNSSharedToolbarItemsNeedAttachment(rightItems, sharedNavigationController.navigationBar)',
    );
    expect(rootPreparation).toContain(
      'setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement',
    );
    expect(rootPreparation).toContain(
      'setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement',
    );
    expect(
      rootPreparation.match(
        /setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement/g,
      ),
    ).toHaveLength(1);
    expect(
      rootPreparation.match(
        /setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement/g,
      ),
    ).toHaveLength(1);
    expect(rootPreparation).not.toContain('layoutIfNeeded');
    expect(rootPreparation).not.toContain('setLeftBarButtonItems:nil');
    expect(rootPreparation).not.toContain('setRightBarButtonItems:nil');
    expect(rootPreparation).not.toContain('removeFromSuperview');
    expect(rootPreparation).not.toContain('addSubview:');
  });

  it('leaves didShow assignments as fallback and preserves semantic animation policy', () => {
    const rootPreparation = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason allowRootDestinationDuringTransition:',
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
    );

    expect(rootPreparation).toContain('RNSHomeToolbarItemSetsAreSemanticallyEqual');
    expect(rootPreparation).toContain(
      '!(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual)',
    );
    expect(rootPreparation).toContain('!isTransitionCompletion');
    expect(rootPreparation).toContain(
      'RNSHomeToolbarItemArraysHaveSameInstances(sharedLeftItems, leftItems)',
    );
    expect(rootPreparation).toContain(
      'RNSHomeToolbarItemArraysHaveSameInstances(sharedRightItems, rightItems)',
    );
  });

  it('uses one generic left/right item path without screen-specific toolbar branches', () => {
    const rootPreparation = sectionBetween(
      generatedController,
      '- (void)prepareSharedNavigationBarForViewController:(UIViewController *)viewController reason:(NSString *)reason allowRootDestinationDuringTransition:',
      '- (void)prepareSharedNavigationBarForWillShowDestinationViewController:',
    );

    expect(rootPreparation).toContain(
      'NSArray<UIBarButtonItem *> *leftItems = materializedItems[@"left"]',
    );
    expect(rootPreparation).toContain(
      'NSArray<UIBarButtonItem *> *rightItems = materializedItems[@"right"]',
    );
    expect(rootPreparation).toContain('setLeftBarButtonItems:leftItems');
    expect(rootPreparation).toContain('setRightBarButtonItems:rightItems');
    expect(rootPreparation).not.toContain('finance-period');
    expect(rootPreparation).not.toContain('settings-profile');
    expect(rootPreparation).not.toContain('home-search');
  });

  it('keeps the 44x44 Home anchor and does not generate repeated ownership helpers', () => {
    const homeToolbar = readFileSync(
      join(projectRoot, 'src', 'components', 'navigation', 'HomeToolbar.tsx'),
      'utf8',
    );

    expect(homeToolbar).toContain('home-toolbar-item:leading-anchor:44x44');
    expect(
      generatedController.match(
        /static UINavigationController \*RNSFindNestedNavigationController/g,
      ),
    ).toHaveLength(1);
    expect(generatedController.match(/RNSSharedToolbarItemsNeedAttachment\(/g)).toHaveLength(3);
    expect(generatedController).toContain(
      'nestedNavigationController setNavigationBarHidden:YES animated:NO',
    );
  });

  it('applies the plugin idempotently to the generated native source', () => {
    if (runDangerousMod === undefined) {
      throw new Error('The iOS dangerous mod is unavailable.');
    }
    const fixtureScreensRoot = join(fixtureRoot, 'node_modules', 'react-native-screens');
    const generatedPaths = fixtureFiles.map((relativePath) =>
      join(fixtureScreensRoot, relativePath),
    );
    const before = generatedPaths.map((filePath) => readFileSync(filePath, 'utf8'));

    runDangerousMod({});

    const after = generatedPaths.map((filePath) => readFileSync(filePath, 'utf8'));
    expect(after).toEqual(before);
  });
});
