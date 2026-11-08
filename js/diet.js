// Alimentazione per tipo di dieta: fonti proteiche, integrazioni da valutare e giornata tipo
// con porzioni calcolate sul fabbisogno proteico della persona.

export const DIET_LABEL = {
  onnivora: 'Onnivora', flessitariana: 'Flessitariana', pescetariana: 'Pescetariana',
  'latto-ovo': 'Vegetariana (latticini e uova)', latto: 'Latto-vegetariana', vegana: 'Vegana',
};

// moltiplicatore del fabbisogno proteico: le proteine vegetali sono un po' meno digeribili
export const PROTEIN_FACTOR = { onnivora: 1, flessitariana: 1, pescetariana: 1, 'latto-ovo': 1.05, latto: 1.05, vegana: 1.1 };

// alimenti: proteine per 100 g (o per pezzo) e grammi di base
const F = {
  yogurtGreco: { n: 'Yogurt greco 0%', p: 10, g: 200 },
  skyr: { n: 'Skyr', p: 11, g: 150 },
  yogurtSoia: { n: 'Yogurt di soia', p: 4, g: 250 },
  avena: { n: 'Fiocchi d’avena', p: 13, g: 40, fixed: true },
  noci: { n: 'Noci', p: 15, g: 15, fixed: true },
  semiLino: { n: 'Semi di lino macinati', p: 18, g: 10, fixed: true },
  frutta: { n: 'Frutti di bosco o una banana', p: 1, g: 120, fixed: true },
  protPisello: { n: 'Proteine vegetali in polvere', p: 80, g: 25 },
  fiocchiLatte: { n: 'Fiocchi di latte', p: 11, g: 150 },
  ricotta: { n: 'Ricotta vaccina', p: 9, g: 150 },
  parmigiano: { n: 'Parmigiano', p: 33, g: 20 },
  lenticchie: { n: 'Lenticchie cotte', p: 9, g: 200 },
  ceci: { n: 'Ceci cotti', p: 8.5, g: 200 },
  fagioli: { n: 'Fagioli cotti', p: 8, g: 200 },
  tofu: { n: 'Tofu', p: 13, g: 200 },
  tempeh: { n: 'Tempeh', p: 19, g: 150 },
  seitan: { n: 'Seitan', p: 25, g: 120 },
  edamame: { n: 'Edamame', p: 11, g: 120 },
  mandorle: { n: 'Mandorle', p: 21, g: 20, fixed: true },
  cereale: { n: 'Cereale integrale (pasta, riso, farro)', p: 12, g: 70, fixed: true },
  pane: { n: 'Pane integrale', p: 9, g: 60, fixed: true },
  verdure: { n: 'Verdure a volontà', p: 2, g: 250, fixed: true },
  uova: { n: 'Uova (1 uovo = 60 g)', p: 12.5, g: 120 },
  albume: { n: 'Albume', p: 11, g: 150 },
  pollo: { n: 'Petto di pollo o tacchino', p: 23, g: 150 },
  pesce: { n: 'Pesce (salmone, merluzzo, orata)', p: 20, g: 180 },
  tonno: { n: 'Tonno al naturale', p: 25, g: 80 },
  manzo: { n: 'Carne magra di manzo', p: 22, g: 150 },
};

const MENUS = {
  latto: {
    colazione: ['yogurtGreco', 'avena', 'noci', 'frutta'],
    pranzo: ['lenticchie', 'cereale', 'parmigiano', 'verdure'],
    spuntino: ['skyr', 'mandorle'],
    cena: ['tofu', 'pane', 'verdure', 'semiLino'],
  },
  'latto-ovo': {
    colazione: ['yogurtGreco', 'avena', 'noci', 'frutta'],
    pranzo: ['ceci', 'cereale', 'verdure', 'parmigiano'],
    spuntino: ['fiocchiLatte', 'mandorle'],
    cena: ['uova', 'pane', 'verdure', 'ricotta'],
  },
  vegana: {
    colazione: ['yogurtSoia', 'protPisello', 'avena', 'semiLino'],
    pranzo: ['lenticchie', 'cereale', 'verdure'],
    spuntino: ['edamame', 'mandorle'],
    cena: ['tempeh', 'cereale', 'verdure'],
  },
  pescetariana: {
    colazione: ['yogurtGreco', 'avena', 'noci', 'frutta'],
    pranzo: ['fagioli', 'cereale', 'verdure'],
    spuntino: ['skyr', 'mandorle'],
    cena: ['pesce', 'pane', 'verdure'],
  },
  flessitariana: {
    colazione: ['yogurtGreco', 'avena', 'noci', 'frutta'],
    pranzo: ['ceci', 'cereale', 'verdure'],
    spuntino: ['skyr', 'mandorle'],
    cena: ['pollo', 'pane', 'verdure'],
  },
  onnivora: {
    colazione: ['yogurtGreco', 'avena', 'noci', 'frutta'],
    pranzo: ['pollo', 'cereale', 'verdure'],
    spuntino: ['skyr', 'mandorle'],
    cena: ['pesce', 'pane', 'verdure', 'fagioli'],
  },
};

const MEAL_LABEL = { colazione: 'Colazione', pranzo: 'Pranzo', spuntino: 'Spuntino', cena: 'Cena' };
const MEAL_SHARE = { colazione: 0.25, pranzo: 0.3, spuntino: 0.15, cena: 0.3 };

/** giornata tipo con porzioni scalate per raggiungere le proteine del giorno */
export function mealPlan(proteinTarget, dieta = 'onnivora') {
  const menu = MENUS[dieta] || MENUS.onnivora;
  const meals = Object.entries(menu).map(([k, ids]) => {
    const target = proteinTarget * MEAL_SHARE[k];
    const base = ids.reduce((a, id) => a + (F[id].p * F[id].g) / 100, 0);
    const fixedP = ids.filter((id) => F[id].fixed).reduce((a, id) => a + (F[id].p * F[id].g) / 100, 0);
    const scale = Math.min(1.8, Math.max(0.6, (target - fixedP) / Math.max(1, base - fixedP)));
    const items = ids.map((id) => {
      const f = F[id];
      const g = f.fixed ? f.g : Math.round((f.g * scale) / 10) * 10;
      return { name: f.n, grams: g, protein: Math.round((f.p * g) / 100) };
    });
    return { id: k, label: MEAL_LABEL[k], items, protein: items.reduce((a, i) => a + i.protein, 0) };
  });
  return { meals, total: meals.reduce((a, m) => a + m.protein, 0) };
}

/** consigli specifici per la dieta (integrazioni da valutare con il medico) */
export function dietNotes(dieta, p = {}) {
  const out = [];
  const veg = ['latto', 'latto-ovo', 'vegana'].includes(dieta);
  if (!veg && dieta !== 'pescetariana') return out;
  const female = p.sesso === 'F';
  out.push({ icon: '🌱', title: 'Le tue fonti proteiche', text: dieta === 'vegana'
    ? 'Legumi, tofu, tempeh, seitan, edamame, yogurt di soia, frutta secca e semi. Combina cereali e legumi nella giornata e, se serve, usa proteine vegetali in polvere per arrivare al fabbisogno.'
    : 'Yogurt greco o skyr, fiocchi di latte, ricotta, formaggi stagionati in piccole quantità, legumi, tofu, tempeh, seitan e frutta secca. Distribuisci le proteine su 4 pasti: ogni pasto dovrebbe averne 25–35 g.' });
  if (veg) out.push({ icon: '💊', title: 'Vitamina B12', text: dieta === 'vegana'
    ? 'Con un’alimentazione vegana l’integrazione di B12 è indispensabile: parlane con il medico per dose e forma.'
    : 'Latticini e formaggi danno poca B12: falla controllare con gli esami del sangue e valuta con il medico un integratore.' });
  if (veg) out.push({ icon: '🩸', title: 'Ferro', text: `Il ferro dei vegetali si assorbe meglio con la vitamina C: aggiungi agrumi, peperoni o kiwi ai pasti con legumi e lontano da tè e caffè.${female ? ' Per le donne è utile controllare la ferritina una volta l’anno.' : ''}` });
  out.push({ icon: '🐟', title: 'Omega-3', text: dieta === 'pescetariana' ? 'Pesce azzurro 2 volte a settimana copre il fabbisogno.' : 'Noci, semi di lino o di chia ogni giorno; valuta con il medico un integratore di omega-3 da alghe (DHA/EPA).' });
  if (veg) out.push({ icon: '⚡', title: 'Creatina (facoltativa)', text: 'Chi mangia poca carne ha riserve di creatina più basse: 3–5 g al giorno di creatina monoidrato è l’integratore con più prove per forza e massa muscolare. Chiedi conferma al medico, soprattutto se hai problemi renali.' });
  if (dieta === 'vegana') out.push({ icon: '🦴', title: 'Calcio, iodio e vitamina D', text: 'Bevande vegetali e yogurt di soia arricchiti di calcio, sale iodato e un controllo della vitamina D.' });
  return out;
}
