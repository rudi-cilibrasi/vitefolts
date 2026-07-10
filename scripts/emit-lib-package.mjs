// Writes a standalone package.json into dist-lib/ so the emitted engine is a
// self-contained, publishable npm package (issue #17): `cd dist-lib && npm publish`.
import { readFileSync, writeFileSync } from 'node:fs';

const root = JSON.parse(readFileSync('package.json', 'utf8'));

const pkg = {
    name: '@folts/core',
    version: root.version,
    description:
        'First-order logic engine: parse, clausal-form conversion, and linear resolution with paramodulation.',
    type: 'module',
    main: './engine.js',
    module: './engine.js',
    types: './engine.d.ts',
    exports: {
        '.': { types: './engine.d.ts', import: './engine.js' },
    },
    files: ['*.js', '*.d.ts'],
    dependencies: { immutable: root.dependencies.immutable },
    license: 'MIT',
    repository: { type: 'git', url: 'git+https://github.com/rudi-cilibrasi/vitefolts.git' },
    keywords: ['first-order-logic', 'theorem-prover', 'resolution', 'paramodulation', 'fol'],
};

writeFileSync('dist-lib/package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`wrote dist-lib/package.json (${pkg.name}@${pkg.version})`);
