import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Wholesale Registrar icon presentation', () => {
  it('uses the screen background for both mode-selection icon circles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(tabs)/registrar/index.tsx'),
      'utf8',
    );

    expect(source).not.toContain('registrarModeIconSurface');
    expect(
      source.match(/styles\.modeIcon, \{ backgroundColor: theme\.colors\.background \}/g),
    ).toHaveLength(2);
  });
});
