import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
const worker = await build({ entryPoints: ['web/nonlinear-worker.ts'], bundle: true,
  platform: 'browser', format: 'iife', target: 'es2022', write: false, logLevel: 'silent' });
const workerSource = worker.outputFiles[0].text;
await build({ entryPoints: ['web/main.ts'], bundle: true, platform: 'browser', format: 'esm',
  target: 'es2022', outfile: 'dist/app.js', sourcemap: true, logLevel: 'info',
  plugins: [{ name: 'embedded-transient-worker', setup(bundle) {
    bundle.onLoad({ filter: /worker-source\.ts$/ }, () => ({
      contents: `export const workerSource = ${JSON.stringify(workerSource)};`, loader: 'js',
    }));
  } }] });
// Same browser model, bundled without the DOM so Node integration tests exercise
// the production analysis path rather than reimplementing calculations.
await build({ entryPoints: ['web/lab.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/lab-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/i18n.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/i18n-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/schematic.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/schematic-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/network-diagram.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/network-diagram-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/builder.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/builder-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/workspace.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/workspace-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/one-port-ui.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/one-port-ui-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/resistor-transform-ui.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/resistor-transform-ui-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/study-guide.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/study-guide-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/guide-navigation.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/guide-navigation-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/transform-navigation.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/transform-navigation-test.js', logLevel: 'silent' });
await build({ entryPoints: ['test/support/diagnostics-ui-entry.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/diagnostics-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/plot.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/plot-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/diode-math.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/diode-math-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/presets.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/presets-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/dc-sweep.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/dc-sweep-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/sweep-lifecycle.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/sweep-lifecycle-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/transient-run.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/transient-run-test.js', logLevel: 'silent' });
await build({ entryPoints: ['test/support/transient-ui-entry.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/transient-presentation-test.js', logLevel: 'silent' });
await build({ entryPoints: ['web/nonlinear-worker.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/nonlinear-worker-test.js', logLevel: 'silent' });
await build({ entryPoints: ['test/support/diode-presentation-entry.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/diode-presentation-test.js', logLevel: 'silent' });
await build({ entryPoints: ['test/support/builder-ui-entry.ts'], bundle: true, platform: 'neutral', format: 'esm',
  target: 'es2022', outfile: 'dist/builder-ui-test.js', logLevel: 'silent' });
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

await build({ entryPoints: ['test/support/bjt-presentation-entry.ts'], bundle: true, platform: 'neutral', format: 'esm', target:'es2022', outfile:'dist/bjt-presentation-test.js', logLevel:'silent' });
