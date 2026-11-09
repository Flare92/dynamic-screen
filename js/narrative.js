// Relazione iniziale: domande guida, analisi del testo libero (offline, regole per l'italiano)
// e analisi avanzata facoltativa con Claude (chiave API dell'utente, chiamata dal browser).

export const QUESTIONS = [
  { id: 'chi', label: 'Chi sei', hint: 'Età, sesso, altezza, peso.', keys: ['eta', 'sesso', 'altezza', 'peso'] },
  { id: 'allenamento', label: 'Come ti alleni oggi', hint: 'Dove, quante volte a settimana, quanto dura.', keys: ['sessioni'] },
  { id: 'scheda', label: 'I tuoi esercizi in palestra', hint: 'Se vai in palestra: cosa fai di solito, con serie e carichi.', keys: ['scheda'], optional: true },
  { id: 'tempo', label: 'Quanto tempo vuoi dedicarci', hint: 'Giorni e minuti in più, a casa o fuori, attrezzi.', keys: ['sessioni'] },
  { id: 'giornata', label: 'La tua giornata', hint: 'Lavoro, passi, sonno, stress.', keys: ['lavoro'] },
  { id: 'cibo', label: 'Come mangi', hint: 'Tipo di alimentazione, cosa escludi.', keys: ['dieta'] },
  { id: 'salute', label: 'Salute e dolori', hint: 'Problemi, infortuni, dolori, farmaci.', keys: ['salute'] },
  { id: 'obiettivo', label: 'Cosa vuoi ottenere', hint: 'Obiettivo, peso desiderato, entro quando.', keys: ['obiettivo'] },
];

import { gymFromNarrative } from './gymreview.js';

export const DIETS = [
  { id: 'onnivora', label: 'Onnivora' },
  { id: 'flessitariana', label: 'Flessitariana' },
  { id: 'pescetariana', label: 'Pescetariana' },
  { id: 'latto-ovo', label: 'Vegetariana' },
  { id: 'latto', label: 'Latto-vegetariana' },
  { id: 'vegana', label: 'Vegana' },
];

export const EXAMPLE = 'Ho 34 anni, sono alto 180 cm e peso 88 kg. Mi alleno 2 volte a settimana in palestra, allenamento da 1 ora a volta: in palestra faccio panca piana 4x8 con 50 kg, lat machine, leg press, alzate laterali, curl per i bicipiti e crunch. Poi vorrei incrementare facendo 15-20 minuti di allenamento almeno altri 3-4 giorni a settimana da casa, dove ho dei manubri. Il resto della giornata sono sedentario perché lavoro seduto al pc, dormo circa 6 ore. Ho un’alimentazione prettamente vegetale tranne yogurt e alcuni formaggi. Ogni tanto ho un leggero mal di schiena. Vorrei perdere la pancia e arrivare a 80 kg entro l’estate.';

// ------------------------------------------------------------------
// Utilità
// ------------------------------------------------------------------

const NUM = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
const toN = (s) => (s === undefined || s === null ? null : /^\d/.test(s) ? Number(String(s).replace(',', '.')) : NUM[s] ?? null);
const NW = '(\\d+|una|un|uno|due|tre|quattro|cinque|sei|sette)';
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function norm(t) {
  return ` ${String(t || '').toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ')} `;
}
function clauses(t) {
  return t.split(/[.;!?\n]+|,\s*(?=poi\b|inoltre\b|e poi\b|in più\b|ma\b)|\s+(?=poi\b|inoltre\b|in più\b|in aggiunta\b)/).map((s) => s.trim()).filter(Boolean);
}
function near(text, idx, radius = 60) { return text.slice(Math.max(0, idx - radius), idx + radius); }
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// ------------------------------------------------------------------
// Analisi offline
// ------------------------------------------------------------------

export function parseNarrative(raw, now = new Date()) {
  const t = norm(raw);
  const p = { condizioni: [], dolori: {}, misure: {}, attrezzi: [] };
  const found = {};
  const evidence = {};
  const mark = (k, ev) => { found[k] = true; if (ev && !evidence[k]) evidence[k] = ev.trim(); };
  let m;

  // --- nome
  if ((m = raw.match(/mi chiamo\s+([A-ZÀ-Ý][\p{L}']+)/u))) { p.nome = m[1]; mark('nome', m[0]); }

  // --- sesso
  if (/\b(sono una (donna|ragazza|signora|mamma)|femmina|incinta|in gravidanza|sono una\b)/.test(t)) { p.sesso = 'F'; mark('sesso', 'donna'); }
  else if (/\b(sono un (uomo|ragazzo|signore|papà)|maschio|sono un papà)\b/.test(t)) { p.sesso = 'M'; mark('sesso', 'uomo'); }
  else {
    const adj = /\b(?:sono|lavoro|sto|resto|rimango|mi sento)\s+(?:molto\s+|abbastanza\s+|un po'\s+)?(sedentari|sedut|stanc|allenat|stressat|impegnat|pigr|magr|nat|appassionat|in sovrappeso\s+e\s+\w+|alt|bass|fort|attiv|pront|motivat|seguit|abituat|costrett)([oa])\b/g;
    let f = 0, mm = 0;
    while ((m = adj.exec(t))) { if (m[2] === 'a') f++; else mm++; }
    if (f || mm) { p.sesso = f > mm ? 'F' : 'M'; mark('sesso', f > mm ? 'dal femminile nel testo' : 'dal maschile nel testo'); }
  }

  // --- età
  if ((m = t.match(/(?<!da |per |negli ultimi |da circa |da quasi )\b(\d{2})\s*anni\b/))) { p.eta = +m[1]; mark('eta', m[0]); }
  else if ((m = t.match(/\bnat[oa] nel (\d{4})/))) { p.eta = now.getFullYear() - +m[1]; mark('eta', m[0]); }

  // --- misure corporee
  const circ = (re, k) => { const r = t.match(re); if (r) { p.misure[k] = +r[1].replace(',', '.'); mark('misure', r[0]); } };
  circ(/\bvita\D{0,25}?(\d{2,3}(?:[.,]\d)?)\s*cm/, 'vita');
  circ(/\bcollo\D{0,25}?(\d{2}(?:[.,]\d)?)\s*cm/, 'collo');
  circ(/\bfianchi\D{0,25}?(\d{2,3}(?:[.,]\d)?)\s*cm/, 'fianchi');
  if ((m = t.match(/(\d{2,3})\s*(?:battiti|bpm)/))) { p.misure.fc = +m[1]; mark('misure', m[0]); }

  // --- altezza
  if ((m = t.match(/\b(?:alt[oa]|altezza|misuro)\D{0,8}?1[.,](\d{2})\b/))) { p.altezza = 100 + +m[1]; mark('altezza', m[0]); }
  else if ((m = t.match(/\b(?:alt[oa]|altezza|misuro)\D{0,8}?(\d{3})\b/))) { p.altezza = +m[1]; mark('altezza', m[0]); }
  else if ((m = t.match(/\b1[.,]([4-9]\d)\b(?!\s*(?:kg|chil|km|litr|euro|ore))/))) { p.altezza = 100 + +m[1]; mark('altezza', m[0]); }
  else {
    const re = /(\d{3})\s*cm/g;
    while ((m = re.exec(t))) { const ctx = t.slice(Math.max(0, m.index - 25), m.index); if (!/vita|collo|fianch|circonfer|coscia|braccio/.test(ctx) && +m[1] >= 130 && +m[1] <= 220) { p.altezza = +m[1]; mark('altezza', m[0]); break; } }
  }

  // --- peso e peso obiettivo
  const kgRe = /(\d{1,3}(?:[.,]\d)?)\s*(?:kg|chili|kili|chilogrammi)\b/g;
  const targets = [];
  while ((m = kgRe.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 40), m.index);
    const v = +m[1].replace(',', '.');
    if (/(perdere|dimagrire di|calare|buttare giù|togliere)\s*(?:circa\s*|almeno\s*|una\s*)?$/.test(before)) targets.push({ type: 'lose', v, ev: m[0] });
    else if (/(prendere|mettere su|aumentare di)\s*(?:circa\s*)?$/.test(before)) targets.push({ type: 'gain', v, ev: m[0] });
    else if (/(arrivare a|scendere a|tornare a|pesare|obiettivo|raggiungere|stare sui|arrivare sui|ai)\s*(?:circa\s*)?$/.test(before)) targets.push({ type: 'abs', v, ev: m[0] });
    else if (!p.peso && v >= 35 && v <= 250) { p.peso = v; mark('peso', m[0]); }
  }
  if (!p.peso && (m = t.match(/\bpeso\s+(?:circa\s+)?(\d{2,3}(?:[.,]\d)?)\b/))) { p.peso = +m[1].replace(',', '.'); mark('peso', m[0]); }
  for (const g of targets) {
    if (g.type === 'abs') p.pesoObiettivo = g.v;
    if (g.type === 'lose' && p.peso) p.pesoObiettivo = Math.round((p.peso - g.v) * 2) / 2;
    if (g.type === 'gain' && p.peso) p.pesoObiettivo = Math.round((p.peso + g.v) * 2) / 2;
    mark('pesoObiettivo', g.ev);
  }

  // --- sessioni di allenamento
  const sessioni = [];
  let lastPlace = null;
  for (const c of clauses(t)) {
    const fq = c.match(new RegExp(`${NW}(?:\\s*(?:-|–|o|a)\\s*${NW})?\\s*(?:volte|volta|giorni|giorno|sessioni|allenamenti|uscite)\\s*(?:a|alla|al|per|ogni|in una|la)?\\s*(?:settimana|sett)`));
    let days = null, daysMin = null;
    if (fq) { daysMin = toN(fq[1]); days = toN(fq[2]) ?? daysMin; if (/almeno|minimo/.test(c.slice(0, fq.index))) days = Math.max(days, daysMin); }
    else if (/\b(tutti i giorni|ogni giorno|quotidianamente)\b/.test(c)) days = daysMin = 7;
    else if (/giorni alterni/.test(c)) { daysMin = 3; days = 4; }
    if (!days) continue;
    let min = null;
    if ((m = c.match(/(\d+)\s*(?:-|–|o|a)\s*(\d+)\s*(?:min|minuti|')/))) min = Math.max(+m[1], +m[2]);
    else if ((m = c.match(/(\d+)\s*(?:min|minuti|')/))) min = +m[1];
    else if (/\bun'? ?ora e mezz/.test(c)) min = 90;
    else if ((m = c.match(/(\d+(?:[.,]\d+)?)\s*or[ae]\b/))) min = Math.round(+m[1].replace(',', '.') * 60);
    else if (/\bun'? ?ora\b/.test(c)) min = 60;
    else if (/mezz'? ?ora/.test(c)) min = 30;
    let luogo = /palestra|gym|centro fitness|sala pesi|crossfit/.test(c) ? 'palestra'
      : /\b(a|da|in) casa\b|domicilio|salotto|home/.test(c) ? 'casa'
        : /parco|all'aperto|fuori|corsa|corro|correre|cammin|bici|pedal|strada|pista|piscina|nuot|trekking|montagna/.test(c) ? 'aperto' : null;
    luogo = luogo || lastPlace || 'casa';
    lastPlace = luogo;
    const nuovo = /vorrei|voglio|mi piacerebbe|incrementare|aggiungere|in più|altri|altre|inizierei|potrei/.test(c);
    sessioni.push({ giorni: days, giorniMin: daysMin, minuti: min || (luogo === 'palestra' ? 60 : 30), luogo, nuovo, testo: c.trim() });
    mark('sessioni', c);
  }
  // non superare 7 giorni a settimana
  let tot = sessioni.reduce((a, s) => a + s.giorni, 0);
  for (const s of [...sessioni].reverse()) { if (tot <= 7) break; const cut = Math.min(s.giorni - (s.giorniMin || 1), tot - 7); s.giorni -= cut; tot -= cut; }

  // --- attrezzi (casa)
  const EQ = [['manubri', /manubri|pesi a casa|kettlebell|bilancier/], ['elastici', /elastic|bande/], ['sbarra', /sbarra|trazioni a casa/], ['bici', /cyclette|bici|spinning/], ['tapis', /tapis/], ['corda', /corda/], ['piscina', /piscina|nuot/]];
  for (const [id, re] of EQ) if (re.test(t)) { p.attrezzi.push(id); mark('attrezzi', id); }
  if (sessioni.some((s) => s.luogo === 'palestra') || /palestra/.test(t)) p.attrezzi.push('palestra');
  p.attrezzi = [...new Set(p.attrezzi)];

  // --- esperienza
  if (/principiante|mai fatto|non mi (sono mai )?allen|ho appena (iniziato|cominciato)|ricomincio|ripartire da zero|fermo da|ferma da/.test(t)) { p.esperienza = 'principiante'; mark('esperienza', 'principiante'); }
  else if ((m = t.match(/da (\d+) anni/)) && +m[1] >= 3 && /allen|palestra|pesi/.test(t)) { p.esperienza = 'avanzato'; mark('esperienza', m[0]); }
  else if (/agonist|gare|competizion|avanzat/.test(t)) { p.esperienza = 'avanzato'; mark('esperienza', 'avanzato'); }
  else if (sessioni.some((s) => !s.nuovo) || /mi alleno|vado in palestra|faccio pesi|mi allenavo/.test(t)) { p.esperienza = 'intermedio'; mark('esperienza', 'ti alleni già'); }

  // --- lavoro e movimento
  if (/sedut|scrivania|ufficio|\bpc\b|computer|smart working|alla guida|autista|sedentari/.test(t)) { p.lavoro = 'sedentario'; mark('lavoro', 'lavoro da seduto'); }
  else if (/in piedi|commess|cameriere|insegnante|parrucchier|infermier/.test(t)) { p.lavoro = 'in_piedi'; mark('lavoro', 'lavoro in piedi'); }
  else if (/muratore|magazzin|operaio|cantiere|facchin|agricolt|lavoro fisico|pesante/.test(t)) { p.lavoro = 'fisico'; mark('lavoro', 'lavoro fisico'); }
  if ((m = t.match(/(\d{1,2}(?:[.\s]?\d{3})?)\s*passi/))) {
    const n = +m[1].replace(/[.\s]/g, '');
    p.passi = n < 3000 ? '<3000' : n < 5000 ? '3000-5000' : n < 7500 ? '5000-7500' : n < 10000 ? '7500-10000' : '>10000';
    mark('passi', m[0]);
  } else if (p.lavoro === 'sedentario' || /sedentari/.test(t)) p.passi = '3000-5000';
  if ((m = t.match(/dormo\D{0,12}?(\d{1,2})(?:[.,]5)?\s*or[ae]|(\d{1,2})\s*ore (?:di sonno|a notte|per notte)/))) { p.sonno = Math.min(9, Math.max(5, +(m[1] || m[2]))); mark('sonno', m[0]); }
  else if (/dormo (poco|male)|insonnia/.test(t)) { p.sonno = 5; mark('sonno', 'dormi poco'); }

  // --- abitudini
  if (/non fumo|ho smesso di fumare|ex fumator/.test(t)) { p.fumo = 'no'; mark('fumo', 'non fumi'); }
  else if (/\bfumo\b|sigarett|fumatore|fumatrice/.test(t)) { p.fumo = 'si'; mark('fumo', 'fumi'); }
  if (/non bevo|astemi|niente alcol|zero alcol/.test(t)) { p.alcol = 'mai'; mark('alcol', 'non bevi'); }
  else if (/(ogni sera|tutti i giorni|spesso|parecchio).{0,20}(vino|birra|alcol|aperitiv)|(vino|birra|alcol|aperitiv).{0,20}(ogni sera|tutti i giorni|spesso)/.test(t)) { p.alcol = 'spesso'; mark('alcol', 'alcol frequente'); }
  else if (/vino|birra|alcol|aperitiv/.test(t)) { p.alcol = 'occasionale'; mark('alcol', 'alcol occasionale'); }
  if (/stress(at[oa])?\s*(molto|tanto|alto)|molto stress|tanto stress|sotto stress|stressatissim|ansia/.test(t)) { p.stress = 'alto'; mark('stress', 'stress alto'); }
  else if (/poco stress|tranquill|rilassat|sereno|serena/.test(t)) { p.stress = 'basso'; mark('stress', 'stress basso'); }
  else if (/stress/.test(t)) { p.stress = 'medio'; mark('stress', 'un po’ di stress'); }
  if (/mangio male|disordinat|fast food|salto i pasti|junk|troppi dolci|sgarr/.test(t)) { p.alimentazione = 'disordinata'; mark('alimentazione', 'alimentazione disordinata'); }
  else if (/mangio bene|attent[oa] a(ll'| )|curat[ao]|equilibrat|conto le calorie|nutrizionista|dietista|vegetal|vegetarian|vegan/.test(t)) { p.alimentazione = 'curata'; mark('alimentazione', 'alimentazione curata'); }

  // --- tipo di dieta
  const dairy = /yogurt|formagg|latte|latticin|ricotta|mozzarella|parmigiano|skyr/.test(t);
  const eggs = /\buov[ao]\b/.test(t);
  const fish = /pesce|tonno|salmone|merluzz|frutti di mare/.test(t);
  const meat = /\bcarne\b|pollo|tacchino|manzo|maiale|salum|prosciutto|bistecc/.test(t);
  const noMeat = /(non|niente|senza|mai)\s+(mangio\s+)?(la\s+)?carne|no carne/.test(t);
  if (/vegan/.test(t) && !/tranne|eccetto|a parte/.test(t)) { p.dieta = 'vegana'; mark('dieta', 'vegana'); }
  else if (/vegetal|vegetarian|plant|veg\b|vegan/.test(t) || noMeat) {
    p.dieta = (meat && !noMeat) ? 'flessitariana' : fish ? 'pescetariana' : eggs && dairy ? 'latto-ovo' : dairy ? 'latto' : eggs ? 'latto-ovo' : /vegetarian/.test(t) ? 'latto-ovo' : 'vegana';
    mark('dieta', DIETS.find((x) => x.id === p.dieta).label);
  } else if (meat || fish) { p.dieta = 'onnivora'; mark('dieta', 'onnivora'); }

  // --- salute: condizioni
  const COND = [['ipertensione', /ipertens|pressione (alta|elevata)/], ['diabete', /diabet/], ['asma', /\basma/], ['cuore', /cardiopat|aritmi|infarto|problemi (al|di) cuore|scompenso|valvol/],
    ['osteoporosi', /osteopor/], ['gravidanza', /incinta|gravidanza/], ['betabloccanti', /betabloccant|beta bloccant/], ['reni', /renal|ai reni/],
    ['petto', /dolore al petto|svenim|giramenti di testa sotto sforzo/]];
  for (const [id, re] of COND) if (re.test(t) && !new RegExp(`non (ho|soffro)[^.]{0,20}(?:${re.source})`).test(t)) { p.condizioni.push(id); mark('salute', id); }
  if (/(operat[oa]|intervento|frattura|rottura|lesione).{0,40}(mes[ei]|settiman|da poco|recente|quest'anno)/.test(t)) { p.condizioni.push('intervento'); mark('salute', 'intervento recente'); }

  // --- salute: dolori
  const nopain = /(non ho|nessun|zero) (dolor|problem|fastidi|acciacc)/.test(t);
  const PAIN = [['lombare', /mal di schiena|schiena|lombar|ernia|sciatic|bassa schiena/], ['collo', /cervical|\bcollo\b/], ['ginocchia', /ginocch|menisc|crociat|rotule/],
    ['spalle', /spall|cuffia dei rotatori/], ['anche', /\banc(a|he)\b|inguin|pubalgi/], ['caviglie', /caviglia|caviglie|distorsion|tallon|plantare|fascite/],
    ['polsi', /polso|polsi|gomito|gomiti|epicondil|tunnel carpale|tendinite/], ['dorsale', /dorsal|schiena alta|scapol/]];
  if (!nopain) {
    for (const [id, re] of PAIN) {
      const r = t.match(re);
      if (!r) continue;
      const ctx = clauses(t).find((c) => re.test(c)) || near(t, r.index, 50);
      let lv = /lieve|legger|un po'|ogni tanto|a volte|fastidio|leggermente|qualche volta|ogni tanto/.test(ctx) ? 1 : /\bfort[ei]\b|molto|acut|\btanto\b|parecchio|invalidant|non riesco/.test(ctx) ? 3 : 2;
      if (/passat|guarit|risolt|in passato|anni fa/.test(ctx) && !/ancora|tuttora/.test(ctx)) lv = Math.min(lv, 1);
      if (id === 'dorsale' && !/schiena alta|dorsal|scapol/.test(ctx)) continue;
      p.dolori[id] = Math.max(p.dolori[id] || 0, lv);
      if (lv >= 2 && ['lombare', 'ginocchia', 'spalle', 'anche'].includes(id)) p.condizioni.push({ lombare: 'schiena', ginocchia: 'ginocchia', spalle: 'spalle', anche: 'anche' }[id]);
      mark('salute', `${id}: ${['', 'lieve', 'medio', 'forte'][lv]}`);
    }
  } else mark('salute', 'nessun dolore');
  if (/(non ho|nessun) (problem|patolog|malatt)|sto bene|in salute/.test(t)) mark('salute', 'nessun problema');
  p.condizioni = [...new Set(p.condizioni)];

  // --- obiettivo
  const GOAL = [
    ['dimagrire', /dimagr|perdere peso|perdere (\d+ )?(kg|chili)|perdere (la )?pancia|grasso|calare|scendere di peso|definire la pancia|tornare in forma|smaltire/],
    ['massa', /massa muscolare|aumentare (la )?massa|mettere su (muscol|massa)|ipertrofia|diventare (più )?grosso|muscoli più grandi|prendere (\d+ )?(kg|chili)/],
    ['tonificare', /tonific|definit|asciug|rassod|scolpit|più tonic/],
    ['resistenza', /correre|corsa|maratona|\d+ ?km|resistenza|fiato|triathlon|ciclismo|gran fondo/],
    ['mobilita', /mobilit|flessibil|postura|rigid|scioltezza|elasticit|yoga/],
    ['salute', /salute|benessere|stare (bene|meglio)|energia|longevit|prevenzione|sentirmi meglio/],
  ];
  let best = null, bestIdx = Infinity;
  const goalPart = t.slice(Math.max(0, t.search(/vorrei|voglio|obiettivo|mi piacerebbe|punto a|desidero|il mio scopo/)));
  for (const [id, re] of GOAL) { const r = goalPart.match(re); if (r && r.index < bestIdx) { best = id; bestIdx = r.index; } }
  if (!best) for (const [id, re] of GOAL) { const r = t.match(re); if (r && r.index < bestIdx) { best = id; bestIdx = r.index; } }
  if (best === 'resistenza' && !/(correre|maratona|km|resistenza|fiato)/.test(goalPart) && p.pesoObiettivo) best = 'dimagrire';
  if (best) { p.obiettivo = best; mark('obiettivo', best); }
  if (!p.obiettivo && p.pesoObiettivo && p.peso) p.obiettivo = p.pesoObiettivo < p.peso ? 'dimagrire' : 'massa';
  if ((m = t.match(/(correre (?:i |una |la )?(?:\d+ ?km|mezza maratona|maratona)|\d+ trazioni|\d+ piegamenti|toccare (?:le )?punte)/))) { p.traguardo = m[1]; mark('obiettivo', m[1]); }

  // --- scadenza
  const y = now.getFullYear();
  const future = (mo, d) => { let dt = new Date(y, mo, d); if (dt <= now) dt = new Date(y + 1, mo, d); return iso(dt); };
  if ((m = t.match(/entro (?:il |la |fine |l'|lo |a )?(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/))) { p.dataObiettivo = future(MONTHS.indexOf(m[1]), 28); mark('obiettivo', m[0]); }
  else if (/entro (l'|la |)estate|per l'estate|prova costume/.test(t)) { p.dataObiettivo = future(5, 21); mark('obiettivo', 'entro l’estate'); }
  else if (/entro natale|per natale/.test(t)) { p.dataObiettivo = future(11, 20); mark('obiettivo', 'entro Natale'); }
  else if (/entro (fine anno|l'anno)/.test(t)) { p.dataObiettivo = future(11, 31); mark('obiettivo', 'entro fine anno'); }
  else if ((m = t.match(/(?:entro|in) (\d+|un|una|due|tre|quattro|sei) (mes[ei]|settiman[ae])/))) {
    const n = toN(m[1]); const dt = new Date(now); if (/mes/.test(m[2])) dt.setMonth(dt.getMonth() + n); else dt.setDate(dt.getDate() + 7 * n);
    p.dataObiettivo = iso(dt); mark('obiettivo', m[0]);
  }

  // --- esercizi che fa già in palestra
  const gym = gymFromNarrative(raw);
  if (gym.length) { p.schedaPalestra = gym.map(gymLine).join('\n'); mark('scheda', gym.map((x) => x.key).join(', ')); }

  if (!Object.keys(p.misure).length) delete p.misure;
  return { profile: p, sessioni, found, evidence };
}

const gymLine = (x) => `${x.raw}${x.sets ? ` ${x.sets}x${x.reps}` : ''}${x.kg ? ` ${x.kg} kg` : ''}`;

// Cosa manca per generare il piano
export const REQUIRED = [
  ['sesso', 'Sesso'], ['eta', 'Età'], ['altezza', 'Altezza'], ['peso', 'Peso'], ['obiettivo', 'Obiettivo'], ['sessioni', 'Quando e quanto ti alleni'],
];
export function coverage(result) {
  const q = QUESTIONS.map((x) => ({ ...x, ok: x.keys.every((k) => result.found[k] || (k === 'salute' && result.found.salute)) }));
  return q;
}

// Converte le sessioni nel formato del profilo e calcola i valori riassuntivi
export function slotsFromSessions(sessioni) {
  return sessioni.map((s, i) => ({ id: `s${i}`, giorni: s.giorni, minuti: s.minuti, luogo: s.luogo }));
}

// ------------------------------------------------------------------
// Analisi avanzata con Claude (facoltativa)
// ------------------------------------------------------------------

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nome: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sesso: { anyOf: [{ type: 'string', enum: ['M', 'F'] }, { type: 'null' }] },
    eta: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    altezza: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'cm' },
    peso: { anyOf: [{ type: 'number' }, { type: 'null' }], description: 'kg' },
    pesoObiettivo: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    dataObiettivo: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'YYYY-MM-DD' },
    obiettivo: { anyOf: [{ type: 'string', enum: ['dimagrire', 'massa', 'tonificare', 'resistenza', 'mobilita', 'salute'] }, { type: 'null' }] },
    traguardo: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    esperienza: { anyOf: [{ type: 'string', enum: ['principiante', 'intermedio', 'avanzato'] }, { type: 'null' }] },
    lavoro: { anyOf: [{ type: 'string', enum: ['sedentario', 'in_piedi', 'fisico'] }, { type: 'null' }] },
    passi: { anyOf: [{ type: 'string', enum: ['<3000', '3000-5000', '5000-7500', '7500-10000', '>10000'] }, { type: 'null' }] },
    sonno: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    fumo: { anyOf: [{ type: 'string', enum: ['no', 'si'] }, { type: 'null' }] },
    alcol: { anyOf: [{ type: 'string', enum: ['mai', 'occasionale', 'spesso'] }, { type: 'null' }] },
    stress: { anyOf: [{ type: 'string', enum: ['basso', 'medio', 'alto'] }, { type: 'null' }] },
    alimentazione: { anyOf: [{ type: 'string', enum: ['disordinata', 'media', 'curata'] }, { type: 'null' }] },
    dieta: { anyOf: [{ type: 'string', enum: DIETS.map((d) => d.id) }, { type: 'null' }] },
    condizioni: { type: 'array', items: { type: 'string', enum: ['ipertensione', 'cuore', 'petto', 'diabete', 'asma', 'schiena', 'ginocchia', 'spalle', 'anche', 'osteoporosi', 'reni', 'gravidanza', 'intervento', 'betabloccanti'] } },
    dolori: {
      type: 'object', additionalProperties: false,
      properties: Object.fromEntries(['collo', 'spalle', 'polsi', 'dorsale', 'lombare', 'anche', 'ginocchia', 'caviglie'].map((k) => [k, { type: 'integer', enum: [0, 1, 2, 3] }])),
      required: ['collo', 'spalle', 'polsi', 'dorsale', 'lombare', 'anche', 'ginocchia', 'caviglie'],
    },
    attrezziCasa: { type: 'array', items: { type: 'string', enum: ['manubri', 'elastici', 'sbarra', 'bici', 'tapis', 'corda', 'piscina'] } },
    sessioni: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { giorni: { type: 'integer' }, minuti: { type: 'integer' }, luogo: { type: 'string', enum: ['palestra', 'casa', 'aperto'] } },
        required: ['giorni', 'minuti', 'luogo'],
      },
    },
    eserciziPalestra: { type: 'array', items: { type: 'string' }, description: 'Esercizi che la persona dice di fare già in palestra, uno per voce, con serie×ripetizioni e kg se indicati (es. "Panca piana 4x8 60 kg"). Vuoto se non ne parla.' },
    sintesi: { type: 'string', description: 'Sintesi in italiano, 2-3 frasi, della situazione della persona' },
    noteCoach: { type: 'array', items: { type: 'string' }, description: 'Punti di attenzione per costruire il piano, in italiano' },
  },
  required: ['nome', 'sesso', 'eta', 'altezza', 'peso', 'pesoObiettivo', 'dataObiettivo', 'obiettivo', 'traguardo', 'esperienza', 'lavoro', 'passi', 'sonno', 'fumo', 'alcol', 'stress', 'alimentazione', 'dieta', 'condizioni', 'dolori', 'attrezziCasa', 'sessioni', 'eserciziPalestra', 'sintesi', 'noteCoach'],
};

const SYSTEM = `Sei un preparatore atletico che legge la relazione iniziale scritta da un cliente in italiano e ne estrae i dati per costruire il suo piano di allenamento.
Regole:
- Riporta solo ciò che il testo dice o implica chiaramente; usa null quando un dato manca. Non inventare numeri.
- "sessioni" elenca TUTTE le sessioni settimanali da pianificare: quelle che fa già e quelle che vuole aggiungere. Per un intervallo (es. "3-4 giorni", "15-20 minuti") usa il valore più alto se dice "almeno", altrimenti il valore intermedio arrotondato. Il totale dei giorni non supera 7.
- "dolori": 0 assente, 1 lieve/occasionale, 2 medio (limita alcuni movimenti), 3 forte.
- "dieta": latto = vegetale più latticini senza uova; latto-ovo = vegetariana con uova; flessitariana = prevalentemente vegetale con un po' di carne.
- Data di riferimento per le scadenze: {{OGGI}}.`;

export async function analyzeWithClaude(text, apiKey) {
  const { Anthropic, betaJSONSchemaOutputFormat } = await import('../vendor/anthropic-sdk.js');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
  const today = new Date().toISOString().slice(0, 10);
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(SCHEMA) },
    system: SYSTEM.replace('{{OGGI}}', today),
    messages: [{ role: 'user', content: `Relazione del cliente:\n\n${text}` }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude non ha potuto analizzare il testo.');
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new Error('Risposta incompleta, riprova.');
  return response.parsed_output;
}

/** unisce il risultato di Claude (prioritario) con l'analisi offline */
export function mergeAI(local, ai) {
  const p = { ...local.profile };
  const found = { ...local.found };
  const set = (k, v, fk = k) => { if (v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) { p[k] = v; found[fk] = true; } };
  ['nome', 'sesso', 'eta', 'altezza', 'peso', 'pesoObiettivo', 'dataObiettivo', 'obiettivo', 'traguardo', 'esperienza', 'lavoro', 'passi', 'sonno', 'fumo', 'alcol', 'stress', 'alimentazione', 'dieta'].forEach((k) => set(k, ai[k]));
  if (ai.condizioni?.length) { p.condizioni = [...new Set([...(p.condizioni || []), ...ai.condizioni])]; found.salute = true; }
  if (ai.dolori) { p.dolori = Object.fromEntries(Object.entries(ai.dolori).filter(([, v]) => v > 0)); found.salute = true; }
  if (ai.attrezziCasa?.length || local.profile.attrezzi?.includes('palestra')) {
    p.attrezzi = [...new Set([...(ai.attrezziCasa || []), ...(ai.sessioni?.some((s) => s.luogo === 'palestra') || local.profile.attrezzi?.includes('palestra') ? ['palestra'] : [])])];
  }
  const sessioni = ai.sessioni?.length ? ai.sessioni.map((s) => ({ ...s, giorni: Math.min(7, Math.max(1, s.giorni)), minuti: Math.min(180, Math.max(10, s.minuti)) })) : local.sessioni;
  if (ai.sessioni?.length) found.sessioni = true;
  if (ai.eserciziPalestra?.length) { p.schedaPalestra = ai.eserciziPalestra.join('\n'); found.scheda = true; }
  return { profile: p, sessioni, found, evidence: local.evidence, sintesi: ai.sintesi, noteCoach: ai.noteCoach || [], ai: true };
}
