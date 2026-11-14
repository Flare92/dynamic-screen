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

// ==================================================================
// Menu settimanale su misura
// Piatti reali con grammature calcolate su calorie e proteine della persona,
// filtrati per tipo di dieta, intolleranze, cibi non graditi, tempo e luogo del pranzo.
// ==================================================================

// per 100 g: [nome, kcal, proteine, carboidrati, grassi, etichette]
// pesi a crudo per pasta, riso, cereali, carne e pesce; legumi già cotti (o in barattolo, sgocciolati)
const FOOD = {
  pasta: ['Pasta integrale', 350, 13, 66, 2.5, ['glutine']],
  riso: ['Riso basmati o integrale', 350, 7.5, 77, 1.5, []],
  farro: ['Farro o orzo', 340, 13, 67, 2.5, ['glutine!']],
  couscous: ['Cous cous integrale', 350, 12, 70, 2, ['glutine!']],
  pane: ['Pane integrale', 240, 9, 45, 2.5, ['glutine']],
  patate: ['Patate', 80, 2, 17, 0.1, []],
  avena: ['Fiocchi d’avena', 370, 13, 60, 7, ['glutine']],
  gallette: ['Gallette di riso o di mais', 380, 8, 80, 3, []],
  pollo: ['Petto di pollo o tacchino', 110, 23, 0, 1.5, ['carne']],
  manzo: ['Manzo magro', 130, 22, 0, 5, ['carne', 'carne_rossa']],
  bresaola: ['Bresaola', 150, 32, 0, 2.5, ['carne', 'carne_rossa']],
  salmone: ['Salmone', 190, 20, 0, 12, ['pesce']],
  merluzzo: ['Merluzzo, orata o platessa', 90, 19, 0, 1.5, ['pesce']],
  tonno: ['Tonno al naturale sgocciolato', 105, 25, 0, 0.8, ['pesce']],
  uova: ['Uova', 140, 12.5, 0.7, 10, ['uova']],
  yogurt: ['Yogurt greco 0%', 57, 10, 4, 0.2, ['latte']],
  latte: ['Latte parzialmente scremato', 46, 3.3, 5, 1.6, ['latte']],
  fiocchi: ['Fiocchi di latte', 90, 11, 3, 4, ['latte']],
  ricotta: ['Ricotta', 140, 9, 3.5, 10, ['latte']],
  mozzarella: ['Mozzarella light', 170, 20, 1, 9, ['latte']],
  feta: ['Feta', 250, 15, 1, 21, ['latte']],
  parmigiano: ['Parmigiano', 390, 33, 0, 28, ['latte', 'nolattosio']],
  lenticchie: ['Lenticchie cotte', 115, 9, 17, 0.5, ['legumi']],
  ceci: ['Ceci cotti', 130, 8.5, 19, 2.5, ['legumi']],
  fagioli: ['Fagioli cotti', 110, 8, 16, 0.5, ['legumi']],
  hummus: ['Hummus', 240, 7, 14, 17, ['legumi']],
  tofu: ['Tofu', 120, 13, 2, 7, ['soia']],
  tempeh: ['Tempeh', 190, 19, 8, 10, ['soia']],
  edamame: ['Edamame sgusciati', 120, 11, 9, 5, ['soia']],
  seitan: ['Seitan', 120, 25, 4, 1.5, ['glutine!']],
  yogurtSoia: ['Yogurt di soia senza zuccheri', 50, 4, 2.5, 2.3, ['soia']],
  bevSoia: ['Bevanda di soia senza zuccheri', 35, 3.3, 1, 1.8, ['soia']],
  protVeg: ['Proteine vegetali in polvere', 380, 80, 5, 5, []],
  verdure: ['Verdure di stagione', 25, 2, 3.5, 0.3, []],
  insalata: ['Insalata mista e pomodori', 18, 1.2, 3, 0.2, []],
  passata: ['Passata di pomodoro', 30, 1.5, 5, 0.2, []],
  frutta: ['Frutta fresca', 55, 0.7, 13, 0.2, []],
  banana: ['Banana', 90, 1.1, 21, 0.3, []],
  olio: ['Olio extravergine d’oliva', 884, 0, 0, 100, []],
  noci: ['Noci o mandorle', 620, 18, 8, 58, ['fruttasecca']],
  arachidi: ['Crema di arachidi 100%', 600, 26, 12, 50, ['fruttasecca']],
  avocado: ['Avocado', 160, 2, 2, 15, []],
  semi: ['Semi di lino o di chia', 500, 18, 8, 40, []],
  miele: ['Miele o marmellata', 290, 0.3, 72, 0, []],
};
const GF_NAME = { pasta: 'Pasta senza glutine (riso, mais o legumi)', pane: 'Pane senza glutine', avena: 'Fiocchi d’avena senza glutine' };

// ruoli: P = porzione calcolata sulle proteine, C = calcolata sulle calorie, F = fissa, ? = facoltativa (si toglie se esclusa)
// D(nome, pasto, parti, opzioni): parti = [alimento, ruolo, grammi base]
const D = (n, pasto, parts, o = {}) => ({ n, pasto, parts: parts.map(([f, r, g]) => ({ f, r, g })), ...o });
const DISHES = [
  // ---- colazione dolce
  D('Yogurt greco con avena, frutta e noci', 'colazione', [['yogurt', 'P', 200], ['avena', 'C', 40], ['frutta', 'F', 150], ['noci', '?', 15]], { tipo: 'dolce', rapido: 1 }),
  D('Porridge di avena con banana e crema di arachidi', 'colazione', [['avena', 'C', 50], ['latte', 'P', 250], ['banana', 'F', 100], ['arachidi', '?', 15]], { tipo: 'dolce', rapido: 1 }),
  D('Pane con ricotta e miele, più un frutto', 'colazione', [['pane', 'C', 60], ['ricotta', 'P', 100], ['miele', 'F', 15], ['frutta', 'F', 150]], { tipo: 'dolce', rapido: 1 }),
  D('Pancake di avena e uova con yogurt e frutta', 'colazione', [['avena', 'C', 40], ['uova', 'P', 110], ['yogurt', 'P', 100], ['frutta', 'F', 100]], { tipo: 'dolce' }),
  D('Yogurt di soia con avena, proteine vegetali e frutta', 'colazione', [['yogurtSoia', 'F', 250], ['protVeg', 'P', 20], ['avena', 'C', 40], ['frutta', 'F', 150], ['semi', 'F', 10]], { tipo: 'dolce', rapido: 1 }),
  D('Porridge con bevanda di soia, banana e crema di arachidi', 'colazione', [['avena', 'C', 50], ['bevSoia', 'F', 250], ['protVeg', 'P', 15], ['banana', 'F', 100], ['arachidi', '?', 15]], { tipo: 'dolce', rapido: 1 }),
  // ---- colazione salata
  D('Uova strapazzate con pane tostato e un frutto', 'colazione', [['uova', 'P', 110], ['pane', 'C', 60], ['frutta', 'F', 150]], { tipo: 'salata', rapido: 1 }),
  D('Pane con fiocchi di latte e pomodori', 'colazione', [['pane', 'C', 70], ['fiocchi', 'P', 150], ['insalata', 'F', 100], ['olio', 'F', 5]], { tipo: 'salata', rapido: 1 }),
  D('Pane con bresaola e un frutto', 'colazione', [['pane', 'C', 70], ['bresaola', 'P', 50], ['frutta', 'F', 150]], { tipo: 'salata', rapido: 1 }),
  D('Toast con avocado e tofu strapazzato', 'colazione', [['pane', 'C', 60], ['tofu', 'P', 120], ['avocado', 'F', 40]], { tipo: 'salata' }),
  D('Pane con hummus, più uno yogurt di soia', 'colazione', [['pane', 'C', 60], ['hummus', 'F', 40], ['yogurtSoia', 'F', 200], ['protVeg', 'P', 15]], { tipo: 'salata', rapido: 1 }),
  // ---- pranzo
  D('Pasta al pomodoro con tonno e insalata', 'pranzo', [['pasta', 'C', 80], ['tonno', 'P', 100], ['passata', 'F', 100], ['insalata', 'F', 150], ['olio', 'F', 10]], { rapido: 1, porta: 1 }),
  D('Insalata di farro con ceci, feta e verdure', 'pranzo', [['farro', 'C', 70], ['ceci', 'P', 150], ['feta', '?', 40], ['verdure', 'F', 200], ['olio', 'F', 10]], { porta: 1 }),
  D('Riso con pollo e verdure saltate', 'pranzo', [['riso', 'C', 80], ['pollo', 'P', 130], ['verdure', 'F', 200], ['olio', 'F', 10]], { porta: 1 }),
  D('Pasta e lenticchie', 'pranzo', [['pasta', 'C', 60], ['lenticchie', 'P', 200], ['passata', 'F', 80], ['parmigiano', '?', 10], ['olio', 'F', 10]], {}),
  D('Riso con uova sode, avocado e verdure', 'pranzo', [['riso', 'C', 80], ['uova', 'P', 110], ['avocado', 'F', 40], ['verdure', 'F', 200], ['olio', 'F', 5]], { rapido: 1, porta: 1 }),
  D('Farro con salmone e zucchine', 'pranzo', [['farro', 'C', 70], ['salmone', 'P', 120], ['verdure', 'F', 200], ['olio', 'F', 5]], { porta: 1 }),
  D('Pasta con ricotta e spinaci', 'pranzo', [['pasta', 'C', 80], ['ricotta', 'P', 120], ['verdure', 'F', 200], ['parmigiano', 'F', 10], ['olio', 'F', 5]], { rapido: 1 }),
  D('Panino integrale con tacchino, verdure grigliate e un frutto', 'pranzo', [['pane', 'C', 100], ['pollo', 'P', 120], ['verdure', 'F', 150], ['olio', 'F', 5], ['frutta', 'F', 150]], { rapido: 1, porta: 1 }),
  D('Cous cous con ceci e verdure', 'pranzo', [['couscous', 'C', 70], ['ceci', 'P', 200], ['verdure', 'F', 200], ['olio', 'F', 10]], { rapido: 1, porta: 1 }),
  D('Riso con tofu e verdure saltate', 'pranzo', [['riso', 'C', 80], ['tofu', 'P', 180], ['verdure', 'F', 200], ['olio', 'F', 10]], { porta: 1 }),
  D('Insalata di patate, fagioli e tonno', 'pranzo', [['patate', 'C', 250], ['fagioli', 'F', 120], ['tonno', 'P', 80], ['insalata', 'F', 150], ['olio', 'F', 10]], { porta: 1 }),
  D('Pasta con edamame e verdure', 'pranzo', [['pasta', 'C', 80], ['edamame', 'P', 150], ['verdure', 'F', 200], ['olio', 'F', 10]], { rapido: 1, porta: 1 }),
  D('Insalata di riso con fagioli, mais e avocado', 'pranzo', [['riso', 'C', 70], ['fagioli', 'P', 220], ['avocado', 'F', 50], ['insalata', 'F', 150], ['olio', 'F', 5]], { porta: 1 }),
  D('Pasta al pomodoro con mozzarella e insalata', 'pranzo', [['pasta', 'C', 80], ['mozzarella', 'P', 100], ['passata', 'F', 100], ['insalata', 'F', 150], ['olio', 'F', 5]], { rapido: 1 }),
  // ---- cena
  D('Salmone al forno con patate e verdure', 'cena', [['salmone', 'P', 150], ['patate', 'C', 250], ['verdure', 'F', 250], ['olio', 'F', 5]], {}),
  D('Zuppa di fagioli con crostini di pane', 'cena', [['fagioli', 'P', 250], ['pane', 'C', 60], ['verdure', 'F', 200], ['parmigiano', '?', 10], ['olio', 'F', 10]], {}),
  D('Petto di pollo alla piastra con pane e verdure', 'cena', [['pollo', 'P', 160], ['pane', 'C', 70], ['verdure', 'F', 250], ['olio', 'F', 10]], { rapido: 1 }),
  D('Frittata di verdure con pane e insalata', 'cena', [['uova', 'P', 165], ['verdure', 'F', 200], ['pane', 'C', 70], ['insalata', 'F', 100], ['olio', 'F', 10]], { rapido: 1 }),
  D('Merluzzo in umido con patate', 'cena', [['merluzzo', 'P', 200], ['patate', 'C', 250], ['passata', 'F', 100], ['verdure', 'F', 200], ['olio', 'F', 10]], {}),
  D('Lenticchie in umido con pane e verdure', 'cena', [['lenticchie', 'P', 250], ['pane', 'C', 60], ['verdure', 'F', 200], ['olio', 'F', 10]], {}),
  D('Tagliata di manzo con rucola, pane e pomodori', 'cena', [['manzo', 'P', 150], ['pane', 'C', 70], ['insalata', 'F', 200], ['olio', 'F', 10]], { rapido: 1 }),
  D('Caprese con mozzarella, pane e verdure grigliate', 'cena', [['mozzarella', 'P', 125], ['pane', 'C', 70], ['insalata', 'F', 150], ['verdure', 'F', 150], ['olio', 'F', 10]], { rapido: 1 }),
  D('Tofu alla piastra con riso e verdure', 'cena', [['tofu', 'P', 200], ['riso', 'C', 60], ['verdure', 'F', 250], ['olio', 'F', 10]], { rapido: 1 }),
  D('Tempeh saltato con verdure e riso', 'cena', [['tempeh', 'P', 130], ['riso', 'C', 60], ['verdure', 'F', 250], ['olio', 'F', 5]], { rapido: 1 }),
  D('Uova al pomodoro con pane', 'cena', [['uova', 'P', 165], ['passata', 'F', 150], ['pane', 'C', 70], ['verdure', 'F', 200], ['olio', 'F', 5]], { rapido: 1 }),
  D('Seitan alla piastra con patate e verdure', 'cena', [['seitan', 'P', 130], ['patate', 'C', 250], ['verdure', 'F', 250], ['olio', 'F', 10]], { rapido: 1 }),
  D('Ceci speziati con verdure e riso', 'cena', [['ceci', 'P', 220], ['riso', 'C', 50], ['verdure', 'F', 250], ['olio', 'F', 10]], {}),
  D('Fiocchi di latte con pane e verdure crude', 'cena', [['fiocchi', 'P', 200], ['pane', 'C', 70], ['insalata', 'F', 200], ['olio', 'F', 10]], { rapido: 1 }),
  D('Tonno con fagioli, cipolla e pane', 'cena', [['tonno', 'P', 120], ['fagioli', 'F', 120], ['pane', 'C', 60], ['insalata', 'F', 150], ['olio', 'F', 10]], { rapido: 1 }),
  // ---- spuntini
  D('Yogurt greco con un frutto', 'spuntino', [['yogurt', 'P', 150], ['frutta', 'C', 150]], { rapido: 1, porta: 1 }),
  D('Un frutto e una manciata di noci', 'spuntino', [['frutta', 'C', 150], ['noci', 'F', 20]], { rapido: 1, porta: 1 }),
  D('Gallette con fiocchi di latte', 'spuntino', [['gallette', 'C', 20], ['fiocchi', 'P', 120]], { rapido: 1 }),
  D('Gallette con hummus e verdure crude', 'spuntino', [['gallette', 'C', 20], ['hummus', 'F', 50], ['insalata', 'F', 100]], { rapido: 1, porta: 1 }),
  D('Uovo sodo e un frutto', 'spuntino', [['uova', 'P', 55], ['frutta', 'C', 150]], { rapido: 1, porta: 1 }),
  D('Gallette con bresaola', 'spuntino', [['gallette', 'C', 20], ['bresaola', 'P', 40]], { rapido: 1, porta: 1 }),
  D('Yogurt di soia con noci', 'spuntino', [['yogurtSoia', 'P', 200], ['noci', '?', 15], ['frutta', 'C', 100]], { rapido: 1, porta: 1 }),
  D('Edamame e un frutto', 'spuntino', [['edamame', 'P', 100], ['frutta', 'C', 150]], { rapido: 1, porta: 1 }),
  D('Frullato di banana con proteine vegetali', 'spuntino', [['bevSoia', 'F', 250], ['banana', 'C', 100], ['protVeg', 'P', 15]], { rapido: 1 }),
];

// pranzo fuori casa: cosa ordinare, con una stima di calorie e proteine
const FUORI = [
  { n: 'Insalatona con tonno o pollo, uova e un panino piccolo', kcal: 520, p: 35, tags: ['carne', 'pesce', 'uova', 'glutine'], alt: 'Chiedi il condimento a parte.' },
  { n: 'Pasta al pomodoro (un piatto raso) e un secondo di pesce o carne bianca con verdure', kcal: 650, p: 38, tags: ['carne', 'pesce', 'glutine'], alt: 'Salta il pane e il dolce.' },
  { n: 'Piadina o panino con bresaola o tacchino, rucola e grana, più un frutto', kcal: 560, p: 32, tags: ['carne', 'latte', 'glutine'], alt: 'Evita salse e formaggi fusi.' },
  { n: 'Poke o bowl: riso, salmone o tonno, edamame, verdure', kcal: 600, p: 32, tags: ['pesce', 'soia'], alt: 'Salse a parte, niente tempura.' },
  { n: 'Zuppa di legumi con crostini e un’insalata', kcal: 480, p: 22, tags: ['legumi', 'glutine'], alt: 'Aggiungi uno yogurt per le proteine.' },
  { n: 'Insalatona con ceci o fagioli, mozzarella o feta e un panino piccolo', kcal: 540, p: 26, tags: ['legumi', 'latte', 'glutine'], alt: 'Chiedi il condimento a parte.' },
  { n: 'Bowl vegetale: riso o cous cous, tofu o legumi, verdure, hummus', kcal: 580, p: 24, tags: ['legumi', 'soia'], alt: 'Chiedi una porzione doppia di proteine vegetali.' },
  { n: 'Frittata o omelette con verdure, pane e insalata', kcal: 520, p: 28, tags: ['uova', 'glutine'], alt: 'Pane sì, patatine no.' },
];

const DIET_EXCLUDE = {
  onnivora: [], flessitariana: ['carne_rossa'], pescetariana: ['carne'],
  'latto-ovo': ['carne', 'pesce'], latto: ['carne', 'pesce', 'uova'], vegana: ['carne', 'pesce', 'uova', 'latte'],
};
// cibi che la persona non mangia → etichette da escludere
export const NON_CIBI = [
  { id: 'pesce', label: 'Pesce', tags: ['pesce'] },
  { id: 'carne_rossa', label: 'Carne rossa', tags: ['carne_rossa'] },
  { id: 'carne', label: 'Carne', tags: ['carne'] },
  { id: 'uova', label: 'Uova', tags: ['uova'] },
  { id: 'latticini', label: 'Latte e formaggi', tags: ['latte'] },
  { id: 'legumi', label: 'Legumi', tags: ['legumi'] },
  { id: 'soia', label: 'Tofu e soia', tags: ['soia'] },
];
export const INTOLLERANZE = [
  { id: 'lattosio', label: 'Lattosio' },
  { id: 'glutine', label: 'Glutine (celiachia)' },
  { id: 'fruttasecca', label: 'Frutta secca' },
];

const MEAL_NAME = { colazione: 'Colazione', spuntino1: 'Spuntino di metà mattina', pranzo: 'Pranzo', spuntino2: 'Spuntino del pomeriggio', cena: 'Cena' };
const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const r5 = (g) => Math.max(5, Math.round(g / 5) * 5);
const r10 = (g) => Math.max(10, Math.round(g / 10) * 10);

/** struttura della giornata: quali pasti e che quota di calorie */
export function mealStructure(p = {}) {
  const pasti = Number(p.pasti) || 4;
  const salto = p.colazione === 'salto';
  const ids = [];
  if (!salto) ids.push('colazione');
  if (pasti >= 5 || (salto && pasti >= 4)) ids.push('spuntino1');
  ids.push('pranzo');
  if (pasti >= 4 || ['pomeriggio', 'sera', 'notte'].includes(p.fame)) ids.push('spuntino2');
  ids.push('cena');
  const base = { colazione: 0.24, spuntino1: 0.09, pranzo: 0.34, spuntino2: 0.1, cena: 0.32 };
  // fame la sera: più cibo nella prima parte della giornata
  if (p.fame === 'sera' || p.fame === 'notte') { base.colazione += 0.03; base.pranzo += 0.03; base.cena -= 0.04; }
  const tot = ids.reduce((a, k) => a + base[k], 0);
  return ids.map((id) => ({ id, label: MEAL_NAME[id], share: base[id] / tot }));
}

function excludedTags(p = {}) {
  const dieta = p.dieta || 'onnivora';
  const tags = new Set(DIET_EXCLUDE[dieta] || []);
  for (const id of p.noncibi || []) (NON_CIBI.find((x) => x.id === id)?.tags || []).forEach((t) => tags.add(t));
  const intol = new Set(p.intolleranze || []);
  if (intol.has('fruttasecca')) tags.add('fruttasecca');
  if (intol.has('glutine')) tags.add('glutine!');
  return { tags, intol, dieta };
}

/** piatti adatti alla persona per un pasto; le parti facoltative escluse vengono tolte */
function dishesFor(pasto, p, ex) {
  const out = [];
  for (const d of DISHES) {
    if (d.pasto !== pasto) continue;
    const parts = [];
    let ok = true;
    for (const part of d.parts) {
      const bad = FOOD[part.f][5].some((t) => ex.tags.has(t));
      if (bad && part.r === '?') continue;
      if (bad) { ok = false; break; }
      parts.push(part);
    }
    if (!ok) continue;
    // chi non è vegano non riceve i piatti pensati con bevande e yogurt vegetali, salvo scelta sua
    const vegOnly = d.parts.some((x) => ['yogurtSoia', 'bevSoia', 'protVeg'].includes(x.f));
    if (vegOnly && ex.dieta !== 'vegana' && !ex.tags.has('latte')) continue;
    out.push({ ...d, parts });
  }
  return out;
}

function foodName(f, ex) {
  const [n, , , , , tags] = FOOD[f];
  if (f === 'protVeg' && ex.dieta !== 'vegana') return 'Proteine in polvere (facoltative)';
  if (ex.intol.has('glutine') && GF_NAME[f]) return GF_NAME[f];
  if (ex.intol.has('lattosio') && tags.includes('latte') && !tags.includes('nolattosio')) return `${n} senza lattosio`;
  return n;
}
function portionLabel(f, g) {
  if (f === 'uova') { const n = Math.max(1, Math.round(g / 55)); return n === 1 ? '1 uovo' : `${n} uova`; }
  if (f === 'olio') return g <= 5 ? '1 cucchiaino' : g <= 10 ? '1 cucchiaio' : `${Math.round(g / 10)} cucchiai`;
  if (f === 'verdure' || f === 'insalata') return g >= 200 ? 'porzione abbondante' : 'una porzione';
  if (f === 'frutta') return g >= 250 ? '2 frutti' : '1 frutto';
  if (f === 'banana') return '1 banana';
  return `${g} g`;
}

// porzioni realistiche: [minimo, massimo] in grammi
const LIMITS = {
  pasta: [60, 120], riso: [60, 120], farro: [60, 110], couscous: [60, 110], pane: [50, 120], patate: [150, 400], avena: [30, 80], gallette: [10, 40],
  frutta: [150, 300], banana: [100, 100],
  yogurt: [125, 250], latte: [150, 300], ricotta: [80, 150], mozzarella: [80, 125], fiocchi: [100, 200], feta: [30, 60],
  ceci: [120, 250], lenticchie: [120, 250], fagioli: [120, 250], tofu: [100, 200], tempeh: [80, 150], seitan: [80, 150], edamame: [80, 150],
  pollo: [100, 200], manzo: [100, 200], salmone: [100, 180], merluzzo: [130, 250], tonno: [60, 160], uova: [55, 165], bresaola: [40, 80],
  protVeg: [10, 30], yogurtSoia: [125, 250],
};
const lim = (f, g) => (LIMITS[f] ? Math.min(LIMITS[f][1], Math.max(LIMITS[f][0], g)) : g);
const SMALL = ['olio', 'noci', 'arachidi', 'semi', 'miele', 'parmigiano', 'protVeg', 'gallette', 'feta'];

function mkItem(f, g, ex) {
  const grams = f === 'uova' ? Math.max(1, Math.round(g / 55)) * 55 : SMALL.includes(f) ? r5(g) : r10(g);
  const F = FOOD[f];
  return { food: f, name: foodName(f, ex), grams, label: portionLabel(f, grams), kcal: (F[1] * grams) / 100, protein: (F[2] * grams) / 100, carbs: (F[3] * grams) / 100, fat: (F[4] * grams) / 100 };
}
function totals(meal) {
  const sum = (k) => Math.round(meal.items.reduce((a, x) => a + x[k], 0));
  meal.kcal = sum('kcal'); meal.protein = sum('protein'); meal.carbs = sum('carbs'); meal.fat = sum('fat');
  return meal;
}

/** grammature di un piatto per avvicinarsi alle calorie e alle proteine del pasto, restando in porzioni realistiche */
function portion(dish, kcalT, protT, ex) {
  const g = dish.parts.map((x) => x.g);
  const prot = () => dish.parts.reduce((a, x, i) => a + (FOOD[x.f][2] * g[i]) / 100, 0);
  const kcal = () => dish.parts.reduce((a, x, i) => a + (FOOD[x.f][1] * g[i]) / 100, 0);
  const idx = (r) => dish.parts.map((x, i) => (x.r === r ? i : -1)).filter((i) => i >= 0);
  // 1) proteine: scala le fonti proteiche
  const P = idx('P');
  if (P.length) {
    const fromP = P.reduce((a, i) => a + (FOOD[dish.parts[i].f][2] * g[i]) / 100, 0);
    const k = (protT - (prot() - fromP)) / Math.max(1, fromP);
    P.forEach((i) => { g[i] = lim(dish.parts[i].f, g[i] * k); });
  }
  // 2) calorie: scala i carboidrati
  const C = idx('C');
  if (C.length) {
    const fromC = C.reduce((a, i) => a + (FOOD[dish.parts[i].f][1] * g[i]) / 100, 0);
    const k = (kcalT - (kcal() - fromC)) / Math.max(1, fromC);
    C.forEach((i) => { g[i] = lim(dish.parts[i].f, g[i] * k); });
  }
  // 3) condimenti: un po' di più se mancano calorie, meno se sono troppe
  const oil = dish.parts.findIndex((x) => x.f === 'olio');
  if (oil >= 0) {
    const diff = kcalT - kcal();
    if (diff > 60) g[oil] = Math.min(20, g[oil] + Math.round(diff / 9 / 5) * 5);
    else if (diff < -60) g[oil] = Math.max(5, g[oil] - 5);
  }
  if (kcal() > kcalT * 1.15) dish.parts.forEach((x, i) => { if (['noci', 'arachidi', 'avocado'].includes(x.f)) g[i] *= 0.6; });
  return totals({ name: dish.n, items: dish.parts.map((x, i) => mkItem(x.f, g[i], ex)), rapido: !!dish.rapido });
}

// aggiunte per arrivare alle proteine del giorno senza porzioni esagerate, adatte al momento della giornata
const BOOST = { yogurt: 170, fiocchi: 150, uova: 110, tonno: 80, bresaola: 50, edamame: 120, protVeg: 25, yogurtSoia: 200 };
const BOOST_BY_MEAL = {
  dolce: ['yogurt', 'protVeg'], salata: ['uova', 'fiocchi', 'yogurt', 'protVeg'],
  spuntino: ['yogurt', 'fiocchi', 'uova', 'bresaola', 'edamame', 'protVeg'], pasto: ['yogurt', 'yogurtSoia'],
};
function boostersFor(meal, tipoCol, ex) {
  const key = meal.id === 'colazione' ? tipoCol : meal.id.startsWith('spuntino') ? 'spuntino' : 'pasto';
  return BOOST_BY_MEAL[key].filter((f) => !FOOD[f][5].some((t) => ex.tags.has(t)) && !meal.items.some((x) => x.food === f));
}

const mainSource = (dish) => dish.parts.find((x) => x.r === 'P')?.f || dish.parts[0].f;

/**
 * Menu di 7 giorni.
 * p: profilo (dieta, pasti, colazione, pranzo, cucina, intolleranze, noncibi, fame)
 * n: { kcal, protein } fabbisogno giornaliero
 */
export function weekMenu(p, n) {
  const ex = excludedTags(p);
  const struct = mealStructure(p);
  const poco = p.cucina === 'poco';
  const pick = (pasto, filter = () => true) => {
    let list = dishesFor(pasto, p, ex).filter(filter);
    if (poco && list.filter((d) => d.rapido).length >= 3) list = list.filter((d) => d.rapido);
    return list;
  };
  const tipoCol = p.colazione === 'salata' ? 'salata' : 'dolce';
  const lists = {
    colazione: pick('colazione', (d) => d.tipo === tipoCol),
    pranzo: p.pranzo === 'portato' ? pick('pranzo', (d) => d.porta) : pick('pranzo'),
    cena: pick('cena'),
    spuntino: pick('spuntino'),
  };
  if (!lists.colazione.length) lists.colazione = pick('colazione');
  if (!lists.pranzo.length) lists.pranzo = pick('pranzo');
  const fuori = FUORI.filter((f) => {
    const need = f.tags.filter((t) => ['carne', 'pesce', 'uova', 'legumi', 'soia', 'latte'].includes(t));
    const okProt = need.some((t) => !ex.tags.has(t));
    const mustAvoid = f.tags.some((t) => (t === 'glutine' && ex.intol.has('glutine')));
    // i piatti con più fonti proteiche vanno bene se almeno una è ammessa; quelli vegetali solo se lo sono tutte
    const veg = !f.tags.some((t) => ['carne', 'pesce', 'uova'].includes(t));
    return okProt && !mustAvoid && (veg || !['latto', 'latto-ovo', 'vegana', 'pescetariana'].includes(ex.dieta) || f.tags.some((t) => !ex.tags.has(t) && ['pesce', 'uova'].includes(t) && ex.dieta !== 'vegana' && !(t === 'uova' && ex.dieta === 'latto') && !(t === 'pesce' && ex.dieta !== 'pescetariana')));
  });

  const days = DAYS.map((label, di) => {
    const meals = [];
    let lunchSrc = null;
    let usedK = 0, usedP = 0, leftShare = 1;
    for (const m of struct) {
      const kcalT = ((n.kcal - usedK) * m.share) / leftShare;
      const protT = Math.max(m.id.startsWith('spuntino') ? 8 : 20, ((n.protein - usedP) * m.share) / leftShare);
      leftShare -= m.share;
      let meal;
      if (m.id === 'pranzo' && p.pranzo === 'fuori' && fuori.length) {
        const f = fuori[di % fuori.length];
        meal = { name: f.n, items: [], kcal: f.kcal, protein: f.p, carbs: null, fat: null, fuori: true, nota: f.alt };
      } else {
        const key = m.id.startsWith('spuntino') ? 'spuntino' : m.id;
        const list = lists[key];
        if (!list.length) continue;
        let k = (di * (key === 'cena' ? 1 : key === 'pranzo' ? 1 : 2) + (m.id === 'spuntino2' ? 1 : 0)) % list.length;
        // a cena una fonte proteica diversa dal pranzo
        if (key === 'cena' && lunchSrc) for (let t = 0; t < list.length && mainSource(list[k]) === lunchSrc; t++) k = (k + 1) % list.length;
        meal = portion(list[k], kcalT, protT, ex);
        if (key === 'pranzo') lunchSrc = mainSource(list[k]);
      }
      usedK += meal.kcal; usedP += meal.protein;
      meals.push({ id: m.id, label: m.label, ...meal });
    }
    // se mancano proteine, aggiungi un alimento proteico dove sta bene (spuntino, colazione, fine pasto)
    const order = ['spuntino2', 'spuntino1', 'colazione', 'cena', 'pranzo'];
    for (let t = 0; t < 3; t++) {
      const have = meals.reduce((a, x) => a + x.protein, 0);
      if (have >= n.protein * 0.93) break;
      const target = order.map((id) => meals.find((m) => m.id === id && !m.fuori && !m.plus && boostersFor(m, tipoCol, ex).length)).find(Boolean);
      if (!target) break;
      const cand = boostersFor(target, tipoCol, ex);
          const f = target.id === 'pranzo' || target.id === 'cena' ? cand[0] : cand[(di + t) % Math.min(cand.length, 2)];
      target.items.push({ ...mkItem(f, BOOST[f], ex), plus: true });
      target.plus = true;
      totals(target);
    }
    // se con le aggiunte si supera il fabbisogno, togli carboidrati dal pasto più ricco
    let over = meals.reduce((a, x) => a + x.kcal, 0) - n.kcal * 1.04;
    for (const m of [...meals].filter((x) => !x.fuori).sort((a, b2) => b2.kcal - a.kcal)) {
      for (const x of m.items) {
        const L = LIMITS[x.food];
        if (over <= 20 || !L || !['pasta', 'riso', 'farro', 'couscous', 'pane', 'patate', 'avena'].includes(x.food)) continue;
        const take = Math.min(Math.max(0, x.grams - L[0]), Math.round(((over / FOOD[x.food][1]) * 100) / 10) * 10);
        if (take > 0) { Object.assign(x, mkItem(x.food, x.grams - take, ex)); over -= (FOOD[x.food][1] * take) / 100; }
      }
      totals(m);
    }
    return { label, meals, kcal: meals.reduce((a, x) => a + x.kcal, 0), protein: meals.reduce((a, x) => a + x.protein, 0) };
  });

  // lista della spesa della settimana
  const tot = {};
  for (const d of days) for (const m of d.meals) for (const it of m.items) {
    if (['verdure', 'insalata', 'frutta', 'passata'].includes(it.food)) { tot[it.food] = tot[it.food] || { name: it.name, grams: 0, n: 0 }; tot[it.food].n++; continue; }
    tot[it.food] = tot[it.food] || { name: it.name, grams: 0, n: 0 };
    tot[it.food].grams += it.grams; tot[it.food].n++;
  }
  const spesa = Object.entries(tot).map(([food, v]) => ({
    food, name: v.name,
    qty: food === 'uova' ? `${Math.round(v.grams / 55)} uova` : food === 'banana' ? `${v.n} banane` : v.grams ? (v.grams >= 1000 ? `${(v.grams / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg` : `${Math.round(v.grams / 10) * 10} g`) : `${v.n} porzioni`,
  })).sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return { days, struct, spesa, avgKcal: Math.round(days.reduce((a, d) => a + d.kcal, 0) / 7), avgProtein: Math.round(days.reduce((a, d) => a + d.protein, 0) / 7) };
}
