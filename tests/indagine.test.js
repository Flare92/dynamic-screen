import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../js/engine.js';
import { BY_ID } from '../js/exercises.js';
import { diagnosi, goalFromSogni, regoleCibo, ZONE_PATTERNS } from '../js/indagine.js';
import { weekMenu, mealStructure } from '../js/diet.js';
import { PASSI, passiPer, passiCoperti, BOZZA_VUOTA } from '../js/flow.js';

const base = {
  nome: 'Test', sesso: 'M', eta: 34, altezza: 180, peso: 88, condizioni: [], dolori: {}, lavoro: 'sedentario', passi: '3000-5000', sonno: 7,
  esperienza: 'intermedio', fumo: 'no', alcol: 'occasionale', alimentazione: 'media', stress: 'medio', obiettivo: 'tonificare', pesoObiettivo: null,
  minuti: 60, giorni: 3, attrezzi: ['palestra'], sessioni: [{ giorni: 3, minuti: 60, luogo: 'palestra' }], dieta: 'onnivora',
};
const START = '2026-11-09';
const mainItems = (plan) => plan.schedule.flatMap((d) => (d.session?.kind === 'forza' ? d.session.blocks.filter((b) => b.name === 'Parte principale').flatMap((b) => b.items) : []));

test('cosa vuoi ottenere: obiettivo e zone', () => {
  assert.deepEqual(goalFromSogni(['ventre', 'tono']), { obiettivo: 'tonificare', zone: ['addome'] });
  assert.equal(goalFromSogni(['ventre', 'peso']).obiettivo, 'dimagrire');
  assert.deepEqual(goalFromSogni(['glutei', 'braccia']).zone, ['glutei', 'gambe', 'braccia']);
  assert.equal(goalFromSogni([]).obiettivo, null);
});

test('ventre piatto con girovita alto: la causa è il grasso, serve un deficit', () => {
  const p = { ...base, sogni: ['ventre'], zone: ['addome'], misure: { vita: 98 }, plica: 'alta', gonfiore: 'mai', lordosi: 'no' };
  const dg = diagnosi(p);
  assert.ok(dg.drivers.fat >= 2);
  assert.ok(dg.findings.some((f) => f.id === 'grasso'));
  const plan = generatePlan(p, { startISO: START });
  assert.equal(plan.nutrition.mode, 'deficit');
  assert.ok(plan.nutrition.kcal < plan.nutrition.tdee);
});

test('ventre piatto con girovita nella norma: niente dieta, lavoro su tono, gonfiore e postura', () => {
  const p = { ...base, peso: 70, sogni: ['ventre'], zone: ['addome'], misure: { vita: 80 }, plica: 'bassa', gonfiore: 'spesso', lordosi: 'si' };
  const dg = diagnosi(p);
  assert.equal(dg.drivers.fat, 0);
  for (const id of ['nograsso', 'gonfiore', 'postura']) assert.ok(dg.findings.some((f) => f.id === id), id);
  const plan = generatePlan(p, { startISO: START });
  assert.equal(plan.nutrition.mode, 'mantenimento');
  assert.ok(plan.nutrition.regole.some((r) => /gonfiore/i.test(r.title)));
  const all = plan.schedule.flatMap((d) => (d.session ? d.session.blocks.flatMap((b) => b.items.map((i) => i.id)) : []));
  assert.ok(all.includes('m_flessori'), 'allungamento dei flessori dell’anca per la postura');
});

test('zone prioritarie: più esercizi, una serie in più ed etichetta', () => {
  const senza = generatePlan({ ...base }, { startISO: START });
  const con = generatePlan({ ...base, zone: ['braccia', 'addome'] }, { startISO: START });
  const braccia = (plan) => mainItems(plan).filter((i) => ['bicipiti', 'tricipiti'].includes(BY_ID[i.id].pat));
  assert.equal(braccia(senza).length, 0);
  assert.ok(braccia(con).length >= 2, 'esercizi per le braccia aggiunti');
  assert.ok(braccia(con).every((i) => i.tag === 'Priorità: braccia'));
  const core = mainItems(con).filter((i) => BY_ID[i.id].pat === 'core');
  assert.ok(core.length && core.every((i) => i.tag === 'Priorità: addome'), 'addome etichettato come priorità');
  const sets = (plan, pat) => mainItems(plan).filter((i) => BY_ID[i.id].pat === pat).reduce((a, i) => a + Number(i.dose.match(/^(\d+)/)[1]), 0);
  assert.ok(sets(con, 'core') > sets(senza, 'core'), 'più serie per l’addome');
  const soloAddome = generatePlan({ ...base, zone: ['addome'] }, { startISO: START });
  assert.ok(mainItems(soloAddome).filter((i) => BY_ID[i.id].pat === 'core').length > mainItems(senza).filter((i) => BY_ID[i.id].pat === 'core').length, 'più esercizi per l’addome');
  for (const z of Object.values(ZONE_PATTERNS)) assert.ok(z.acc.length);
});

test('dopo il parto: niente crunch, torsioni o plank frontali', () => {
  const p = { ...base, sesso: 'F', peso: 65, altezza: 165, zone: ['addome'], sogni: ['ventre'], parto: 'recente', misure: { vita: 80 } };
  const plan = generatePlan(p, { startISO: START });
  const ids = plan.schedule.flatMap((d) => (d.session ? d.session.blocks.flatMap((b) => b.items.map((i) => i.id)) : []));
  for (const bad of ['c_crunch', 'c_bike', 'c_russian', 'c_plank', 'c_cable']) assert.ok(!ids.includes(bad), bad);
  assert.ok(plan.diagnosi.findings.some((f) => f.id === 'postparto'));
});

test('nessun esercizio ripetuto tra riscaldamento e parte principale', () => {
  const plan = generatePlan({ ...base, zone: ['addome'], sogni: ['ventre'], lordosi: 'si', misure: { vita: 95 } }, { startISO: START });
  for (const d of plan.schedule.filter((x) => x.session?.kind === 'forza')) {
    const warm = d.session.blocks[0].items.map((i) => i.id);
    const main = d.session.blocks[1].items.map((i) => i.id);
    assert.ok(!main.some((id) => warm.includes(id)), `${d.label}: ${main.filter((id) => warm.includes(id))}`);
    assert.equal(new Set(main).size, main.length);
  }
});

test('menu settimanale: calorie e proteine vicine al fabbisogno, porzioni realistiche', () => {
  for (const dieta of ['onnivora', 'pescetariana', 'latto-ovo', 'latto', 'vegana']) {
    for (const kcal of [1500, 2100, 2800]) {
      const protein = Math.round(kcal * 0.07);
      const m = weekMenu({ dieta, pasti: 4, colazione: 'dolce', pranzo: 'casa', cucina: 'medio' }, { kcal, protein });
      assert.equal(m.days.length, 7);
      assert.ok(Math.abs(m.avgKcal - kcal) / kcal < 0.1, `${dieta} ${kcal}: media ${m.avgKcal} kcal`);
      assert.ok(m.avgProtein >= protein * 0.82, `${dieta} ${kcal}: ${m.avgProtein} g di proteine su ${protein}`);
      for (const d of m.days) for (const meal of d.meals) for (const it of meal.items) assert.ok(it.grams > 0 && it.grams <= 400, `${it.name} ${it.grams} g`);
    }
  }
});

test('menu settimanale: rispetta dieta, intolleranze e cibi non graditi', () => {
  const foods = (m) => m.days.flatMap((d) => d.meals.flatMap((x) => x.items.map((i) => i.food)));
  const veg = foods(weekMenu({ dieta: 'vegana', pasti: 5, colazione: 'salata' }, { kcal: 2200, protein: 130 }));
  for (const bad of ['pollo', 'manzo', 'salmone', 'tonno', 'uova', 'yogurt', 'latte', 'mozzarella', 'parmigiano', 'ricotta', 'feta', 'fiocchi']) assert.ok(!veg.includes(bad), `vegana: ${bad}`);
  const latto = foods(weekMenu({ dieta: 'latto', pasti: 4, colazione: 'dolce' }, { kcal: 2000, protein: 120 }));
  for (const bad of ['pollo', 'manzo', 'bresaola', 'salmone', 'merluzzo', 'tonno', 'uova']) assert.ok(!latto.includes(bad), `latto: ${bad}`);
  const no = weekMenu({ dieta: 'onnivora', pasti: 4, colazione: 'dolce', noncibi: ['pesce', 'legumi'], intolleranze: ['glutine', 'lattosio', 'fruttasecca'] }, { kcal: 2000, protein: 120 });
  const f = foods(no);
  for (const bad of ['salmone', 'merluzzo', 'tonno', 'ceci', 'lenticchie', 'fagioli', 'hummus', 'farro', 'couscous', 'seitan', 'noci', 'arachidi']) assert.ok(!f.includes(bad), `escluso: ${bad}`);
  const names = no.days.flatMap((d) => d.meals.flatMap((x) => x.items.map((i) => i.name)));
  assert.ok(names.some((n) => /senza glutine/.test(n)));
  assert.ok(names.filter((n) => /Yogurt greco|Latte parz|Ricotta|Mozzarella|Fiocchi di latte/.test(n)).every((n) => /senza lattosio/.test(n)));
});

test('menu settimanale: struttura dei pasti e pranzo fuori casa', () => {
  assert.deepEqual(mealStructure({ pasti: 3, colazione: 'dolce' }).map((x) => x.id), ['colazione', 'pranzo', 'cena']);
  assert.deepEqual(mealStructure({ pasti: 5, colazione: 'dolce' }).map((x) => x.id), ['colazione', 'spuntino1', 'pranzo', 'spuntino2', 'cena']);
  assert.ok(!mealStructure({ pasti: 4, colazione: 'salto' }).some((x) => x.id === 'colazione'));
  assert.ok(mealStructure({ pasti: 3, colazione: 'dolce', fame: 'sera' }).some((x) => x.id === 'spuntino2'), 'fame la sera: spuntino nel pomeriggio');
  const m = weekMenu({ dieta: 'onnivora', pasti: 3, colazione: 'dolce', pranzo: 'fuori' }, { kcal: 2000, protein: 120 });
  assert.ok(m.days.every((d) => d.meals.find((x) => x.id === 'pranzo').fuori));
  assert.ok(m.spesa.length > 5);
});

test('regole alimentari dalle abitudini dichiarate', () => {
  const r = regoleCibo({ ...base, gonfiore: 'spesso', bibite: 'ogni', dolci: 'spesso', alcol: 'spesso', fame: 'sera', pranzo: 'fuori', cucina: 'poco' });
  for (const t of ['gonfiore', 'Bibite', 'dolce', 'Alcol', 'sera', 'fuori casa', 'cucinare']) assert.ok(r.some((x) => x.title.includes(t) || x.title.toLowerCase().includes(t.toLowerCase())), t);
  assert.equal(regoleCibo({ ...base, gonfiore: 'mai', bibite: 'mai', dolci: 'mai', alcol: 'mai', fame: 'mai', pranzo: 'casa', cucina: 'tanto', misure: { vita: 80 } }).length, 0);
});

test('percorso guidato: le domande si adattano alla persona', () => {
  const ids = (d) => passiPer({ ...BOZZA_VUOTA(), ...d }).map((s) => s.id);
  assert.ok(!ids({ sesso: 'M', eta: 30 }).includes('parto'));
  assert.ok(ids({ sesso: 'F', eta: 30 }).includes('parto'));
  assert.ok(!ids({ sogni: ['massa'], zone: [] }).includes('plica'));
  assert.ok(ids({ sogni: ['ventre'], zone: ['addome'] }).includes('plica'));
  assert.ok(!ids({ sessioni: [{ giorni: 3, minuti: 30, luogo: 'casa' }] }).includes('scheda'));
  assert.ok(ids({ sessioni: [{ giorni: 2, minuti: 60, luogo: 'palestra' }] }).includes('scheda'));
  assert.ok(!ids({}).includes('riepilogo'));
  assert.ok(new Set(PASSI.map((s) => s.id)).size === PASSI.length);
  // dopo il racconto restano solo le domande senza risposta
  const d = { ...BOZZA_VUOTA(), _story: true, sesso: 'M', eta: 34, altezza: 180, peso: 88, lavoro: 'sedentario', passi: '3000-5000', dieta: 'latto', sogni: ['peso'], obiettivo: 'dimagrire' };
  const coperti = passiCoperti(d, {});
  assert.ok(coperti.includes('base') && coperti.includes('giornata') && coperti.includes('dieta'));
  assert.ok(!coperti.includes('recupero') && !coperti.includes('sogni') && !coperti.includes('riepilogo'));
});
