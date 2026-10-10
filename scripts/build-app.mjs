import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['web/main.ts'], bundle: true, platform: 'browser', format: 'esm',
  target: 'es2022', outfile: 'dist/app.js', sourcemap: true, logLevel: 'info' });
// Same browser model, bundled without the DOM so Node integration tests exercise
// the production analysis path rather than reimplementing calculations.
await build({ entryPoints: ['web/lab.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/lab-test.js', logLevel: 'silent' });
await Promise.all([
  copyFile('web/index.html', 'dist/index.html'),
  copyFile('web/style.css', 'dist/style.css'),
]);
