import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';

const assets = ['index.html', 'style.css', 'app.js'];
const html = await readFile('dist/index.html', 'utf8');
if (!html.includes('href="./style.css"') || !html.includes('src="./app.js"')) {
  throw new Error('The application must load its assets relative to /circuits/.');
}

await rm('publish', { recursive: true, force: true });
await mkdir('publish');
await Promise.all(assets.map(asset => copyFile(`dist/${asset}`, `publish/${asset}`)));
process.stdout.write(`Packaged ${assets.join(', ')} in publish/.\n`);
