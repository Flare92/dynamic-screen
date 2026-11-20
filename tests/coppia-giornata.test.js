import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, resizeSession, coupleSession, derive, toISO, addDays, fromISO } from '../js/engine.js';
import { BY_ID } from '../js/exercises.js';
import { dayOptions, applyOption, undoOption, effectiveIndex } from '../js/giornata.js';
import { buildCard, encodeCard, decodeCard, weekTogether, bestTogetherDay } from '../js/coppia.js';
import { coupleMenu, pantryRecipes } from '../js/diet.js';

const base = {
  nome: 'Luca', sesso: 'M', eta: 34, altezza: 180, peso: 88, condizioni: [], dolori: {}, lavoro: 'sedentario', passi: '3000-5000', sonno: 7,
  esperienza: 'intermedio', fumo: 'no', alcol: 'occasionale', alimentazione: 'media', stress: 'medio', obiettivo: 'tonificare', pesoObiettivo: null,
  minuti: 45, giorni: 4, attrezzi: ['manubri', 'palestra'], dieta: 'onnivora', pasti: 4, colazione: 'dolce', pranzo: 'casa',
  sessioni: [{ giorni: 2, minuti: 60, luogo: 'palestra' }, { giorni: 2, minuti: 20, luogo: 'casa' }],
};
const START = '2026-11-09'; // lunedì
const week = (plan, log = {}) => plan.schedule.map((d, i) => { const iso = toISO(addDays(fromISO(START), i)); return { weekday: i, iso, session: d.session, log: log[iso] }; });

test('giornata: poco tempo → versione corta, che il motore ricostruisce sul tempo scelto', () => {
  const plan = generatePlan(base, { startISO: START });
  const ti = plan.schedule.findIndex((d) => d.session?.minutes === 60);
  const opts = dayOptions(week(plan), ti, { energia: 'media', sonno: 'ok', tempo: 25, dolore: false, impegni: [] });
  const corta = opts.find((o) => o.id === 'corta');
  assert.ok(corta && corta.minutes === 25);
  assert.ok(!opts.some((o) => o.id === 'previsto'), 'con 25 minuti non propone l’allenamento da 60');
  const s = resizeSession(base, {}, plan.schedule[ti].session, 25, 1);
  assert.equal(s.minutes, 25);
  assert.equal(s.luogo, 'palestra');
});

test('giornata: stanco → recupero o scambio con un giorno più leggero, applicabile e annullabile', () => {
  const plan = generatePlan(base, { startISO: START });
  const ti = plan.schedule.findIndex((d) => d.session?.kind === 'forza');
  const opts = dayOptions(week(plan), ti, { energia: 'bassa', sonno: 'poco', tempo: 60, dolore: false, impegni: [] });
  assert.ok(opts[0].id === 'recupero' || opts[0].id.startsWith('scambia') || opts[0].id.startsWith('sposta'), opts[0].id);
  const log = {};
  for (const o of opts.filter((x) => x.apply.length)) {
    const undo = applyOption(log, o);
    const today = log[toISO(addDays(fromISO(START), ti))];
    assert.ok(today, o.id);
    undoOption(log, undo);
    for (const l of Object.values(log)) for (const k of ['sessionFrom', 'extra', 'short', 'recupero']) assert.equal(l[k], undefined, `${o.id}: ${k} non annullato`);
  }
});

test('giornata: doppio solo se sostenibile e scambi coerenti', () => {
  const plan = generatePlan(base, { startISO: START });
  const ti = 0;
  const opts = dayOptions(week(plan), ti, { energia: 'bassa', sonno: 'ok', tempo: 15, dolore: false, impegni: [] });
  for (const o of opts.filter((x) => x.id.startsWith('doppio'))) {
    const d = o.day;
    const a = plan.schedule[ti].session, b = plan.schedule[d].session;
    assert.ok(a.minutes + b.minutes <= 100);
    assert.ok(!(a.kind === 'forza' && b.kind === 'forza'));
  }
  const sw = opts.find((o) => o.id.startsWith('scambia'));
  if (sw) {
    const log = {};
    applyOption(log, sw);
    const isoT = toISO(addDays(fromISO(START), ti)), isoD = toISO(addDays(fromISO(START), sw.day));
    assert.equal(effectiveIndex(log[isoT], ti), sw.day);
    assert.equal(effectiveIndex(log[isoD], sw.day), ti);
  }
});

test('giornata: con un dolore nuovo il primo consiglio è il recupero', () => {
  const plan = generatePlan(base, { startISO: START });
  const ti = plan.schedule.findIndex((d) => d.session);
  const opts = dayOptions(week(plan), ti, { energia: 'media', sonno: 'ok', tempo: 60, dolore: true, impegni: [] });
  assert.equal(opts[0].id, 'recupero');
});

test('coppia: il codice si codifica e si decodifica, senza dati di salute', async () => {
  const state = { profile: { ...base, condizioni: ['schiena'], dolori: { lombare: 2 } }, coupleId: null };
  const plan = generatePlan(state.profile, { startISO: START });
  const card = buildCard(state, plan, {}, { week: 2, streak: 3 });
  const code = await encodeCard(card);
  assert.ok(code.length < 2000, `codice di ${code.length} caratteri`);
  const back = await decodeCard(`https://esempio.it/#/coppia?c=${code}`);
  assert.deepEqual(back, JSON.parse(JSON.stringify(card)));
  const txt = JSON.stringify(back);
  assert.ok(!/schiena|lombare|condizioni|dolori/.test(txt), 'nessuna diagnosi nel codice');
  assert.ok(back.no.includes('c_crunch'), 'gli esercizi da evitare sì');
  await assert.rejects(() => decodeCard('zabc'));
});

test('coppia: allenamento insieme adatto a entrambi, con la dose di ciascuno', () => {
  const p2 = { ...base, nome: 'Anna', sesso: 'F', peso: 62, altezza: 165, esperienza: 'principiante', condizioni: ['ginocchia'], obiettivo: 'dimagrire' };
  const card = buildCard({ profile: p2 }, generatePlan(p2, { startISO: START }), {}, {});
  const s = coupleSession(base, {}, card, 45, 'palestra', 1);
  const ids = s.blocks.flatMap((b) => b.items.map((i) => i.id));
  for (const id of ids) assert.ok(!card.no.includes(id), `${id} non adatto ad Anna`);
  for (const id of ids) assert.ok(!BY_ID[id].contra.includes('ginocchia'), id);
  const main = s.blocks.find((b) => b.name === 'Parte principale');
  assert.ok(main.items.every((i) => BY_ID[i.id].cat !== 'strength' || i.partnerDose));
  const pl = derive(base).pl;
  for (const it of main.items) { const e = BY_ID[it.id]; if (e.pat) assert.ok(e.lvl <= Math.min(pl[e.pat], card.pl[e.pat]) + 1, `${it.id} troppo difficile`); }
  const tog = weekTogether(generatePlan(base, { startISO: START }).schedule, card);
  assert.equal(tog.length, 7);
  const best = bestTogetherDay(tog);
  if (best) assert.ok(best.me && best.them);
});

test('coppia: menu con gli stessi piatti, porzioni per ciascuno e le esclusioni di entrambi', () => {
  const m = coupleMenu({ ...base, noncibi: ['pesce'] }, { kcal: 2300, protein: 150 }, { nome: 'Anna', dieta: 'latto', intolleranze: ['lattosio'], noncibi: [], kcal: 1600, protein: 95 });
  assert.equal(m.dieta, 'latto');
  for (const d of m.days) {
    for (const meal of d.meals) {
      for (const it of meal.items) assert.ok(!['pollo', 'manzo', 'bresaola', 'salmone', 'merluzzo', 'tonno', 'uova'].includes(it.food), it.food);
      if (meal.partner) assert.ok(meal.partner.items.some((x) => meal.items.some((y) => y.food === x.food)), 'stesso piatto');
    }
    assert.ok(Math.abs(d.partnerKcal - 1600) / 1600 < 0.15, `kcal Anna ${d.partnerKcal}`);
    assert.ok(Math.abs(d.kcal - 2300) / 2300 < 0.12, `kcal Luca ${d.kcal}`);
  }
  assert.ok(m.days.flatMap((d) => d.meals.flatMap((x) => x.items.map((i) => i.name))).filter((n) => /Yogurt|Ricotta|Mozzarella|Latte/.test(n)).every((n) => /senza lattosio/.test(n)));
});

test('ricette dalla dispensa: con gli ingredienti in casa e vicine ai valori del pasto', () => {
  const r = pantryRecipes(['pollo', 'riso', 'verdure', 'olio', 'ceci', 'pasta', 'passata'], 'pranzo', { kcal: 700, protein: 40 }, { dieta: 'onnivora' });
  assert.ok(r.length >= 2);
  for (const x of r) {
    for (const it of x.items) assert.ok(['pollo', 'riso', 'verdure', 'olio', 'ceci', 'pasta', 'passata'].includes(it.food), it.food);
    assert.ok(Math.abs(x.kcal - 700) / 700 < 0.15, `${x.name}: ${x.kcal} kcal`);
    assert.ok(x.protein >= 30, `${x.name}: ${x.protein} g`);
    assert.ok(x.passi.length >= 2);
  }
  const veg = pantryRecipes(['pollo', 'tofu', 'riso', 'verdure'], 'cena', { kcal: 600, protein: 35 }, { dieta: 'vegana' });
  assert.ok(veg.every((x) => !x.items.some((i) => i.food === 'pollo')));
  assert.deepEqual(pantryRecipes(['riso', 'olio'], 'pranzo', { kcal: 600, protein: 35 }, {}), []);
});

test('allenamento scelto dalla persona: tipo, durata e attrezzi del luogo', async () => {
  const { customSession, CUSTOM_TYPES } = await import('../js/engine.js');
  for (const t of CUSTOM_TYPES) {
    const s = customSession(base, {}, { type: t.id, minutes: 45, luogo: 'palestra' }, 1);
    assert.equal(s.minutes, 45);
    assert.equal(s.luogo, 'palestra');
    assert.equal(s.title, t.label);
    assert.ok(s.blocks.flatMap((b) => b.items).length >= 2, t.id);
  }
  const casa = customSession({ ...base, attrezzi: [] }, {}, { type: 'full', minutes: 30, luogo: 'casa' }, 1);
  for (const it of casa.blocks.flatMap((b) => b.items)) assert.ok(BY_ID[it.id].eq.includes('corpo'), `${it.id} richiede attrezzi che a casa non ci sono`);
  const pal = customSession(base, {}, { type: 'upper', minutes: 60, luogo: 'palestra' }, 1);
  assert.ok(pal.blocks.find((b) => b.name === 'Parte principale').items.some((i) => BY_ID[i.id].eq.includes('palestra')), 'in palestra si usano le macchine');
});
