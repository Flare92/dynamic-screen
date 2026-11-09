import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../js/engine.js';
import { parseGymList, reviewGym, gymFromNarrative, GYM_PICKS, lineIsPick } from '../js/gymreview.js';
import { parseNarrative, EXAMPLE } from '../js/narrative.js';

const base = {
  nome: 'Test', sesso: 'M', eta: 35, altezza: 178, peso: 90,
  condizioni: [], lavoro: 'sedentario', passi: '3000-5000', sonno: 7,
  esperienza: 'intermedio', fumo: 'no', alcol: 'occasionale', alimentazione: 'media', stress: 'medio',
  obiettivo: 'dimagrire', pesoObiettivo: 80, dataObiettivo: null, minuti: 60, giorni: 2, attrezzi: ['palestra'],
  sessioni: [{ giorni: 2, minuti: 60, luogo: 'palestra' }],
};
const START = '2026-11-09';

test('scheda: riconosce nomi comuni, serie, ripetizioni e carichi', () => {
  const l = parseGymList('Panca piana 4x8 60 kg\nLat machine 3x10\nleg press, curl bicipiti e tirate al mento\nsalto della corda magica');
  const byKey = Object.fromEntries(l.filter((x) => x.key).map((x) => [x.key, x]));
  assert.equal(byKey['Panca piana'].sets, 4);
  assert.equal(byKey['Panca piana'].reps, 8);
  assert.equal(byKey['Panca piana'].kg, 60);
  for (const k of ['Lat machine', 'Leg press', 'Curl per i bicipiti', 'Tirate al mento']) assert.ok(byKey[k], k);
});

test('scheda: segnala esercizi rischiosi o controindicati, doppioni e schemi mancanti', () => {
  const p = { ...base, condizioni: ['schiena'] };
  const r = reviewGym(p, parseGymList('panca piana\nchest press\ncroci ai cavi\ntirate al mento\nleg press\ncrunch'));
  const v = Object.fromEntries(r.items.map((x) => [x.key, x]));
  assert.equal(v['Tirate al mento'].verdict, 'cambia');
  assert.ok(v['Tirate al mento'].alt, 'propone un’alternativa');
  assert.equal(v['Crunch / addominali'].verdict, 'cambia', 'crunch con mal di schiena');
  assert.equal(v['Croci / pec deck'].verdict, 'togli', 'terzo esercizio per il petto');
  assert.ok(r.add.some((a) => a.pat === 'hinge'), 'manca la catena posteriore');
  assert.ok(r.add.some((a) => a.pat.startsWith('pull')), 'mancano le tirate');
  assert.ok(r.coverage < 100);
});

test('scheda: gli esercizi da tenere entrano nelle sessioni in palestra', () => {
  const r = reviewGym(base, parseGymList('stacco rumeno\nlat machine\nleg press'));
  assert.ok(r.keep.includes('h_rdl') && r.keep.includes('t_lat'));
  const plan = generatePlan(base, { startISO: START, favorites: r.keep });
  const items = plan.schedule.flatMap((d) => (d.session ? d.session.blocks.flatMap((b) => b.items) : []));
  const tagged = items.filter((it) => it.tag === 'Dalla tua scheda').map((it) => it.id);
  assert.ok(tagged.length >= 2, `esercizi della scheda nel piano: ${tagged}`);
  assert.ok(tagged.every((id) => r.keep.includes(id)));
});

test('relazione: gli esercizi di palestra vengono letti dal testo', () => {
  assert.deepEqual(gymFromNarrative('Di solito faccio una camminata la sera.'), []);
  const r = parseNarrative(EXAMPLE);
  assert.ok(r.found.scheda);
  assert.match(r.profile.schedaPalestra, /panca piana 4x8 50 kg/);
  assert.match(r.profile.schedaPalestra, /lat machine/);
});

test('elenco da toccare: ogni esercizio e macchinario è riconosciuto', () => {
  for (const g of GYM_PICKS) for (const it of g.items) {
    const [x] = parseGymList(it.name);
    assert.ok(x?.key, `${it.name} non riconosciuto`);
    assert.ok(lineIsPick(`${it.name} 4x8 40 kg`, it.name));
  }
  const l = parseGymList('Curl con bilanciere\nHammer curl');
  assert.equal(l.length, 2, 'due varianti dello stesso esercizio restano distinte');
});
