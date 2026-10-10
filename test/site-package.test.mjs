import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('built site references its current relative JS and CSS by content version', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const [asset, attribute] of [['app.js', 'src'], ['style.css', 'href']]) {
    const bytes = await readFile(new URL(`../dist/${asset}`, import.meta.url));
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    assert.ok(html.includes(`${attribute}="./${asset}?v=${version}"`));
  }
});
