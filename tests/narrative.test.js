import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNarrative, EXAMPLE, coverage } from '../js/narrative.js';
import { generatePlan, weeklyMinutes } from '../js/engine.js';
import { mealPlan, dietNotes } from '../js/diet.js';

const NOW = new Date('2026-11-08');
const USER = 'Io mi alleno 2 volte a settimana in palestra allenamento da 1 ora a volta. Poi vorrei incrementare facendo 15 - 20 minuti di allenamento almeno altri 3-4 giorni a settimana da casa. Il restante tempo della giornata sono sedentario perché lavoro seduto a pc. Poi ho un’alimentazione prettamente vegetale tranne yogurt e alcuni formaggi.';

test('relazione dell’utente: sessioni miste, lavoro, dieta, sesso', () => {
  const r = parseNarrative(USER, NOW);
  assert.deepEqual(r.sessioni.map((s) => [s.giorni, s.minuti, s.luogo]), [[2, 60, 'palestra'], [4, 20, 'casa']]);
  assert.equal(r.profile.lavoro, 'sedentario');
  assert.equal(r.profile.dieta, 'latto');
  assert.equal(r.profile.sesso, 'M');
  assert.equal(r.profile.esperienza, 'intermedio');
});

test('esempio completo: dati, dolore lieve, obiettivo e scadenza', () => {
  const r = parseNarrative(EXAMPLE, NOW);
  const p = r.profile;
  assert.equal(p.eta, 34); assert.equal(p.altezza, 180); assert.equal(p.peso, 88);
  assert.equal(p.pesoObiettivo, 80); assert.equal(p.obiettivo, 'dimagrire');
  assert.equal(p.dataObiettivo, '2027-06-21');
  assert.equal(p.dolori.lombare, 1);
  assert.ok(p.attrezzi.includes('manubri'));
  assert.equal(p.sonno, 6);
  assert.ok(coverage(r).every((q) => q.ok), 'tutte le domande coperte');
});

test('varianti di scrittura', () => {
  const a = parseNarrative('Sono una donna di 45 anni, 1,65 e peso 70 chili. Corro 3 volte a settimana per mezz’ora. Ho un forte dolore al ginocchio destro. Vorrei correre la mezza maratona.', NOW);
  assert.equal(a.profile.sesso, 'F'); assert.equal(a.profile.altezza, 165); assert.equal(a.profile.peso, 70);
  assert.deepEqual(a.sessioni.map((s) => [s.giorni, s.minuti, s.luogo]), [[3, 30, 'aperto']]);
  assert.equal(a.profile.dolori.ginocchia, 3);
  assert.equal(a.profile.obiettivo, 'resistenza');
  const b = parseNarrative('Sono vegano, ho la pressione alta e vorrei perdere 6 kg. Peso 82 kg.', NOW);
  assert.equal(b.profile.dieta, 'vegana');
  assert.ok(b.profile.condizioni.includes('ipertensione'));
  assert.equal(b.profile.pesoObiettivo, 76);
  const c = parseNarrative('Non ho dolori. Mi alleno tutti i giorni 20 minuti a casa.', NOW);
  assert.deepEqual(c.profile.dolori, {});
  assert.equal(c.sessioni[0].giorni, 7);
});

test('settimana mista: palestra lunga + sessioni brevi a casa', () => {
  const r = parseNarrative(USER, NOW);
  const p = {
    sesso: 'M', eta: 34, altezza: 180, peso: 88, condizioni: [], dolori: {}, fumo: 'no', alcol: 'mai', stress: 'medio', sonno: 7,
    alimentazione: 'media', obiettivo: 'tonificare', ...r.profile, sessioni: r.sessioni, giorni: 6, minuti: 37,
  };
  const plan = generatePlan(p, { startISO: '2026-11-09' });
  const ses = plan.schedule.filter((d) => d.session).map((d) => d.session);
  assert.equal(ses.length, 6);
  assert.equal(ses.filter((x) => x.luogo === 'palestra' && x.minutes === 60).length, 2);
  assert.equal(ses.filter((x) => x.luogo === 'casa' && x.minutes === 20).length, 4);
  assert.ok(ses.some((x) => x.type === 'postura'), 'chi lavora seduto ha una sessione postura');
  for (const x of ses.filter((y) => y.luogo === 'casa')) {
    const sum = x.blocks.reduce((a, b) => a + b.minutes, 0);
    assert.equal(sum, 20, x.title);
    for (const it of x.blocks.flatMap((b) => b.items)) assert.ok(!['p_machine', 's_legpress', 't_lat', 'r_pulley', 'p_panca'].includes(it.id), `${it.id} non si fa a casa`);
  }
  assert.equal(weeklyMinutes(p), 200);
  assert.ok(plan.summary.length >= 4);
  assert.equal(plan.nutrition.dieta, 'latto');
});

test('alimentazione vegetariana: proteine e giornata tipo', () => {
  const mp = mealPlan(140, 'latto');
  assert.equal(mp.meals.length, 4);
  assert.ok(Math.abs(mp.total - 140) < 30, `totale ${mp.total}`);
  assert.ok(mp.meals.flatMap((m) => m.items).every((i) => !/pollo|pesce|uova|manzo|tonno/i.test(i.name)));
  const vg = mealPlan(120, 'vegana');
  assert.ok(vg.meals.flatMap((m) => m.items).every((i) => !/yogurt greco|skyr|parmigiano|ricotta|fiocchi di latte/i.test(i.name)));
  assert.ok(dietNotes('vegana').some((n) => /B12/.test(n.title)));
  assert.equal(dietNotes('onnivora').length, 0);
});

test('in palestra si usano gli attrezzi della palestra, non quelli di casa', () => {
  for (const obiettivo of ['dimagrire', 'tonificare', 'salute', 'resistenza']) {
    for (const esperienza of ['principiante', 'intermedio']) {
      const p = {
        sesso: 'M', eta: 34, altezza: 180, peso: 85, condizioni: [], dolori: {}, fumo: 'no', alcol: 'mai', stress: 'medio', sonno: 7,
        alimentazione: 'media', lavoro: 'sedentario', passi: '5000-7500', esperienza, obiettivo, attrezzi: ['palestra', 'elastici'],
        sessioni: [{ giorni: 2, minuti: 60, luogo: 'palestra' }, { giorni: 3, minuti: 20, luogo: 'casa' }], giorni: 5, minuti: 36,
      };
      const plan = generatePlan(p, { startISO: '2026-11-09' });
      for (const d of plan.schedule.filter((x) => x.session?.luogo === 'palestra' && x.session.kind === 'forza')) {
        const main = d.session.blocks.find((b) => b.name === 'Parte principale').items.filter((i) => !/^c_|^k_|^g_/.test(i.id));
        const gym = main.filter((i) => /p_floor|p_machine|p_panca|s_legpress|s_goblet|s_backsquat|h_rdl$|h_hipthrust|h_stacco|l_affman|r_man|r_pulley|r_bil|t_lat$|t_neg|t_trazioni|v_lento|v_alzate/.test(i.id));
        assert.ok(gym.length >= Math.ceil(main.length * 0.6), `${obiettivo}/${esperienza}: ${main.map((i) => i.id).join(', ')}`);
        assert.ok(!main.some((i) => /_el$|_el_|r_towel|r_tavolo|s_sitstand|p_muro/.test(i.id)), `${obiettivo}: attrezzi di casa in palestra`);
      }
    }
  }
});
