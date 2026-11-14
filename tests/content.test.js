import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/exercises.js';
import { guideFor, MUSCLE_LABELS } from '../js/guide.js';
import { DEMOS, hasDemo } from '../js/demos.js';
import { existsSync } from 'node:fs';

test('ogni esercizio ha una guida completa', () => {
  for (const ex of EXERCISES) {
    const g = guideFor(ex.id);
    assert.ok(g, `manca la guida di ${ex.id}`);
    for (const k of ['perche', 'respiro', 'ritmo', 'facile', 'difficile', 'sicurezza']) assert.ok(g[k], `${ex.id}: manca ${k}`);
    for (const k of ['mm', 'setup', 'passi', 'errori']) assert.ok(Array.isArray(g[k]) && g[k].length, `${ex.id}: manca ${k}`);
    for (const m of g.mm) {
      assert.ok(MUSCLE_LABELS[m], `${ex.id}: muscolo sconosciuto ${m}`);
    }
  }
});

test('le foto dimostrative esistono e sono collegate a esercizi reali', () => {
  for (const [id, d] of Object.entries(DEMOS)) {
    assert.ok(EXERCISES.some((e) => e.id === id), `foto per un esercizio inesistente: ${id}`);
    for (const k of [0, 1]) assert.ok(existsSync(new URL(`../media/ex/${d.f}_${k}.webp`, import.meta.url)), `manca la foto ${d.f}_${k}`);
  }
  const forza = EXERCISES.filter((e) => e.cat === 'strength');
  const conFoto = forza.filter((e) => hasDemo(e.id)).length;
  assert.ok(conFoto / forza.length >= 0.85, `solo ${conFoto}/${forza.length} esercizi di forza hanno la foto`);
});
