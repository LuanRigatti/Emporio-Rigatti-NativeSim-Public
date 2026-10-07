import { readFileSync } from 'node:fs';

const pluginSource = readFileSync('plugins/withRNScreensHideBottomBarWhenPushed.js', 'utf8');

describe('Home toolbar coordinator patch', () => {
  it('uses stable semantic item markers to recognize rematerialized Home toolbar items', () => {
    expect(pluginSource).toContain('Emporio Rigatti: Home toolbar semantic comparison');
    expect(pluginSource).toContain('home-toolbar-item:');
    expect(pluginSource).toContain('RNSHomeToolbarItemArraysAreSemanticallyEqual');
    expect(pluginSource).toContain('RNSHomeToolbarItemSetsAreSemanticallyEqual');
    expect(pluginSource).toContain(
      'RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceLeft, sharedLeft)',
    );
    expect(pluginSource).toContain(
      'RNSHomeToolbarItemArraysAreSemanticallyEqual(sourceRight, sharedRight)',
    );
  });

  it('disables animation only for equivalent items during selected Home header resync', () => {
    expect(pluginSource).toContain('Emporio Rigatti: Home toolbar replacement policy');
    expect(pluginSource).toContain('[reason isEqualToString:@"header-materialization/resync"]');
    expect(pluginSource).toContain('self.selectedIndex == (NSUInteger)tabIndex');
    expect(pluginSource).toContain(
      '!(isSelectedHomeTab && isHeaderMaterializationResync && areCompleteToolbarSetsSemanticallyEqual)',
    );
    expect(pluginSource).toContain(
      'setLeftBarButtonItems:leftItems animated:shouldAnimateToolbarItemReplacement',
    );
    expect(pluginSource).toContain(
      'setRightBarButtonItems:rightItems animated:shouldAnimateToolbarItemReplacement',
    );
    expect(pluginSource).toContain('RNSHomeToolbarItemArraysHaveSameInstances');
  });
});
