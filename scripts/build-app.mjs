import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['web/main.ts'], bundle: true, platform: 'browser', format: 'esm',
  target: 'es2022', outfile: 'dist/app.js', sourcemap: true, logLevel: 'info' });
// Same browser model, bundled without the DOM so Node integration tests exercise
// the production analysis path rather than reimplementing calculations.
await build({ entryPoints: ['web/lab.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/lab-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/i18n.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/i18n-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/schematic.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/schematic-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/builder.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/builder-test.js', logLevel: 'silent' });
const [html, app, style] = await Promise.all([
  readFile('web/index.html', 'utf8'), readFile('dist/app.js'), readFile('web/style.css'),
]);
const version = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
await Promise.all([
  writeFile('dist/index.html', html
    .replace('href="./style.css"', `href="./style.css?v=${version(style)}"`)
    .replace('src="./app.js"', `src="./app.js?v=${version(app)}"`)),
  copyFile('web/style.css', 'dist/style.css'),
]);
