// Builds the browser global bundle (dist/fontsketch.js and .min.js) and the
// type declarations generated from the JSDoc comments (types/).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
rmSync('dist', { recursive: true, force: true });
rmSync('types', { recursive: true, force: true });

const common = {
  entryPoints: ['src/index.mjs'],
  bundle: true,
  format: 'iife',
  globalName: 'fontsketch',
  platform: 'browser',
  target: ['es2020'],
  external: ['brotli-wasm'],
  legalComments: 'none',
};
await build({ ...common, outfile: 'dist/fontsketch.js' });
await build({ ...common, outfile: 'dist/fontsketch.min.js', minify: true });
await build({ ...common, format: 'esm', outfile: 'dist/fontsketch.esm.js', minify: true });

execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], { stdio: 'inherit' });
console.log('build: dist/ and types/ written');
