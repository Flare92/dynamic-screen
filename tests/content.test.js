import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/exercises.js';
import { guideFor, MUSCLE_LABELS } from '../js/guide.js';
import { MOTION_MAP, MOTIONS, MUSCLE_SEGMENTS } from '../js/motions.js';

test('ogni esercizio ha una guida completa', () => {
  for (const ex of EXERCISES) {
    const g = guideFor(ex.id);
    assert.ok(g, `manca la guida di ${ex.id}`);
    for (const k of ['perche', 'respiro', 'ritmo', 'facile', 'difficile', 'sicurezza']) assert.ok(g[k], `${ex.id}: manca ${k}`);
    for (const k of ['mm', 'setup', 'passi', 'errori']) assert.ok(Array.isArray(g[k]) && g[k].length, `${ex.id}: manca ${k}`);
    for (const m of g.mm) {
      assert.ok(MUSCLE_LABELS[m], `${ex.id}: muscolo sconosciuto ${m}`);
      assert.ok(MUSCLE_SEGMENTS[m], `${ex.id}: muscolo senza segmento 3D ${m}`);
    }
  }
});

test('ogni esercizio ha un’animazione 3D valida', () => {
  for (const ex of EXERCISES) {
    const m = MOTION_MAP[ex.id];
    assert.ok(m, `manca il movimento di ${ex.id}`);
    const name = Array.isArray(m) ? m[0] : m;
    const mo = MOTIONS[name];
    assert.ok(mo && mo.kf.length >= 2, `${ex.id}: movimento ${name} non valido`);
  }
});
