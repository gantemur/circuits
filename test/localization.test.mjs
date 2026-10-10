import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { en, mn, language, setLanguage, t, translate, preferredLanguage,
  readLanguage, persistLanguage, languageStorageKey } from '../dist/i18n-test.js';
import { createLab, analyze, updateDocument, importNative, exportNative, csvFor } from '../dist/lab-test.js';

const placeholders = value => [...value.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map(match => match[1]).sort();

test('localization: both dictionaries have exactly the same keys and interpolation parameters', async () => {
  assert.deepEqual(Object.keys(mn).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.deepEqual(placeholders(mn[key]), placeholders(en[key]), key);
    assert.ok(en[key].trim() && mn[key].trim(), key);
    const params = Object.fromEntries(placeholders(en[key]).map(name => [name, `VALUE_${name}`]));
    for (const lang of ['en','mn']) {
      setLanguage(lang);
      const result = translate(key, params);
      assert.ok(!/\{[a-zA-Z0-9]+\}/.test(result), `${lang}:${key}`);
    }
  }
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  for (const [, key] of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) assert.ok(key in en, `HTML key ${key}`);
  assert.match(Object.values(mn).join(' '), /[ӨҮ]/);
});

test('localization: browser preference, explicit choice, unavailable storage, and fallback', () => {
  assert.equal(preferredLanguage(['mn-MN','en-US'], null), 'mn');
  assert.equal(preferredLanguage(['en-US','mn-MN'], null), 'en');
  assert.equal(preferredLanguage(['fr-FR'], null), 'en');
  assert.equal(preferredLanguage(['en-US'], 'mn'), 'mn');
  assert.equal(preferredLanguage(['mn-MN'], 'en'), 'en');
  assert.equal(preferredLanguage(['mn-MN'], 'invalid'), 'mn');
  let saved = null;
  const storage = { getItem(key) { assert.equal(key, languageStorageKey); return saved; },
    setItem(key,value) { assert.equal(key, languageStorageKey); saved=value; } };
  assert.equal(readLanguage(['mn-MN'], storage), 'mn');
  persistLanguage('en', storage);
  assert.equal(readLanguage(['mn-MN'], storage), 'en');
  assert.equal(readLanguage(['mn-MN'], { getItem() { throw Error('disabled'); } }), 'mn');
  assert.doesNotThrow(() => persistLanguage('mn', { setItem() { throw Error('disabled'); } }));
  setLanguage('mn');assert.equal(language(),'mn');assert.equal(t('frequency'),'Давтамж');
  setLanguage('en');assert.equal(t('frequency'),'Frequency');
});

test('localization: language never changes edited native JSON, analyses, or CSV conventions', () => {
  const state=createLab('rc');
  assert.equal(updateDocument(state,d => { d.circuit.components.find(c => c.id==='R').value=2000; }).ok,true);
  const before=analyze(state),native=exportNative(state),frequency=csvFor(before,state,'frequency'),transient=csvFor(before,state,'transient');
  setLanguage('mn');
  const after=analyze(state);
  assert.equal(exportNative(state),native);
  assert.deepEqual(after.sweep,before.sweep);
  assert.deepEqual(after.transient,before.transient);
  assert.equal(csvFor(after,state,'frequency'),frequency);
  assert.equal(csvFor(after,state,'transient'),transient);
  assert.match(frequency,/^"frequency_Hz"/);
  assert.match(transient,/^"time_s"/);
  assert.equal(importNative(state,native).ok,true);
  assert.equal(exportNative(state),native);
  setLanguage('en');
});

test('localization: import errors and unsupported extraction have stable diagnostic identifiers', () => {
  const state=createLab('rc'),before=exportNative(state);
  const bad=importNative(state,'not JSON');
  assert.equal(bad.ok,false);assert.equal(bad.errorCode,'invalid-json');assert.equal(exportNative(state),before);
  const invalid=importNative(state,'{"circuit":{}}');
  assert.equal(invalid.errorCode,'invalid-schema');assert.equal(exportNative(state),before);
  const cascade=analyze(createLab('rc-cascade'));
  assert.equal(cascade.algebraic.reason,'storage-structure');
});

test('localization: Mongolian numerical and time-method terms stay distinct', () => {
  setLanguage('mn');
  assert.match(t('diagnosticSummary',{residual:0,pivot:1}),/Гол элементүүдийн харьцаа \(pivot ratio\): 1/);
  assert.doesNotMatch(t('diagnosticSummary',{residual:0,pivot:1}),/туйлын харьцаа/);
  assert.match(t('transientSummary',{step:0.01,duration:1,output:'out',unit:'V'}),/Далд Эйлерийн арга \(Backward Euler\)/);
  assert.match(t('logarithmicSweep'),/давтамжийн мужийн тооцоо/i);
  assert.match(t('presetRlcSubtitle'),/Далайц нь буурах/);
  assert.equal(t('importRejected',{reason:t('invalidJson')}),
    'Импорт татгалзагдлаа: JSON бичвэр хүчинтэй биш. Одоогийн баримт өөрчлөгдөөгүй.');
  setLanguage('en');
});
