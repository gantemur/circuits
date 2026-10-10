import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const assets = ['index.html', 'style.css', 'app.js'];
const html = await readFile('dist/index.html', 'utf8');
const version = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const [style, app] = await Promise.all([readFile('dist/style.css'), readFile('dist/app.js')]);
if (!html.includes(`href="./style.css?v=${version(style)}"`) ||
    !html.includes(`src="./app.js?v=${version(app)}"`)) {
  throw new Error('The application must load its assets relative to /circuits/.');
}

await rm('publish', { recursive: true, force: true });
await mkdir('publish');
await Promise.all(assets.map(asset => copyFile(`dist/${asset}`, `publish/${asset}`)));
process.stdout.write(`Packaged ${assets.join(', ')} in publish/.\n`);
