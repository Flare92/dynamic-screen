// Revisione della scheda di palestra dell'utente: riconosce gli esercizi che scrive con i nomi
// comuni, controlla sicurezza, livello, equilibrio e copertura degli schemi motori, e suggerisce
// cosa tenere, cambiare, ridurre, togliere o aggiungere.

import { BY_ID } from './exercises.js';
import { checkExercise, suggestForPattern, alternativesFor } from './engine.js';

// catalogo: dal più specifico al più generico (il primo che corrisponde vince)
// id: esercizio della libreria (null = non in libreria) · pat: schema motorio · tipo: fondamentale | complementare | isolamento | cardio
const C = (re, o) => ({ re, ...o });
export const CATALOG = [
  C(/leg ?curl|curl (per i |per )?femoral/, { name: 'Leg curl', id: null, pat: 'hinge', tipo: 'isolamento', mus: 'femorali' }),
  C(/leg ?extension|extension (per i )?quadricip/, { name: 'Leg extension', id: null, pat: 'squat', tipo: 'isolamento', mus: 'quadricipiti', contra: ['ginocchia'] }),
  C(/hip ?thrust/, { name: 'Hip thrust', id: 'h_hipthrust', pat: 'hinge', tipo: 'fondamentale', mus: 'glutei' }),
  C(/stacco rumeno|rdl|stacchi rumeni|stacco a gambe tese/, { name: 'Stacco rumeno', id: 'h_rdl', pat: 'hinge', tipo: 'fondamentale', mus: 'femorali' }),
  C(/stacc|deadlift/, { name: 'Stacco da terra', id: 'h_stacco', pat: 'hinge', tipo: 'fondamentale', mus: 'catena posteriore' }),
  C(/good ?morning/, { name: 'Good morning', id: null, pat: 'hinge', tipo: 'complementare', mus: 'lombari', contra: ['schiena'] }),
  C(/iperestension|hyperextension|back extension|lombari alla panca/, { name: 'Iperestensioni', id: 'h_superman', pat: 'hinge', tipo: 'complementare', mus: 'lombari' }),
  C(/goblet/, { name: 'Goblet squat', id: 's_goblet', pat: 'squat', tipo: 'fondamentale', mus: 'quadricipiti' }),
  C(/leg ?press|pressa/, { name: 'Leg press', id: 's_legpress', pat: 'squat', tipo: 'fondamentale', mus: 'quadricipiti' }),
  C(/hack ?squat/, { name: 'Hack squat', id: 's_legpress', pat: 'squat', tipo: 'fondamentale', mus: 'quadricipiti' }),
  C(/bulgar|split squat/, { name: 'Split squat bulgaro', id: 'l_bulgaro', pat: 'lunge', tipo: 'fondamentale', mus: 'quadricipiti e glutei' }),
  C(/affond|lunge/, { name: 'Affondi', id: 'l_affman', pat: 'lunge', tipo: 'fondamentale', mus: 'quadricipiti e glutei' }),
  C(/step ?up/, { name: 'Step-up', id: 'l_step', pat: 'lunge', tipo: 'fondamentale', mus: 'quadricipiti e glutei' }),
  C(/squat/, { name: 'Squat con bilanciere', id: 's_backsquat', pat: 'squat', tipo: 'fondamentale', mus: 'quadricipiti' }),
  C(/abdu[ct]tor|abdutt|adduttor|adductor/, { name: 'Abductor/adductor machine', id: null, pat: 'glutei', tipo: 'isolamento', mus: 'glutei e adduttori' }),
  C(/calf|polpacc/, { name: 'Calf raise', id: 'k_calf', pat: 'calf', tipo: 'isolamento', mus: 'polpacci' }),
  C(/panca inclinat|inclinata/, { name: 'Panca inclinata', id: 'p_panca_man', pat: 'push_h', tipo: 'fondamentale', mus: 'pettorali alti' }),
  C(/panca.*manubri|distension.*manubri|spinte.*manubri.*panca/, { name: 'Panca con manubri', id: 'p_panca_man', pat: 'push_h', tipo: 'fondamentale', mus: 'pettorali' }),
  C(/panca|bench/, { name: 'Panca piana', id: 'p_panca', pat: 'push_h', tipo: 'fondamentale', mus: 'pettorali' }),
  C(/chest ?press/, { name: 'Chest press', id: 'p_machine', pat: 'push_h', tipo: 'fondamentale', mus: 'pettorali' }),
  C(/croci|pec ?deck|butterfly|\bfly\b|chest fly|cavi incrociati|crossover/, { name: 'Croci / pec deck', id: null, pat: 'push_h', tipo: 'isolamento', mus: 'pettorali' }),
  C(/piegament|flession|push ?up/, { name: 'Piegamenti', id: 'p_classici', pat: 'push_h', tipo: 'fondamentale', mus: 'pettorali' }),
  C(/\bdip/, { name: 'Dip', id: 'p_dip', pat: 'push_h', tipo: 'complementare', mus: 'tricipiti e pettorali' }),
  C(/tirate al mento|upright/, { name: 'Tirate al mento', id: null, pat: 'push_v', tipo: 'isolamento', mus: 'deltoidi', contra: ['spalle'], risky: 'stringe l’articolazione della spalla in rotazione interna: è tra gli esercizi più associati a fastidi alla spalla' }),
  C(/lento|military|shoulder ?press|spinte (sopra la testa|in alto)|arnold/, { name: 'Lento avanti / shoulder press', id: 'v_lento', pat: 'push_v', tipo: 'fondamentale', mus: 'deltoidi' }),
  C(/alzate laterali|laterali|lateral raise/, { name: 'Alzate laterali', id: 'v_alzate', pat: 'push_v', tipo: 'isolamento', mus: 'deltoidi laterali' }),
  C(/alzate frontali|frontali/, { name: 'Alzate frontali', id: null, pat: 'push_v', tipo: 'isolamento', mus: 'deltoidi anteriori' }),
  C(/face ?pull/, { name: 'Face pull', id: null, pat: 'pull_h', tipo: 'complementare', mus: 'deltoidi posteriori e cuffia' }),
  C(/rear delt|deltoidi posteriori|alzate (a busto )?(90|inclinato)|reverse fly|croci inverse/, { name: 'Alzate posteriori', id: null, pat: 'pull_h', tipo: 'isolamento', mus: 'deltoidi posteriori' }),
  C(/lat ?machine|pulldown|lat ?pull|tirate (al petto|alla lat)/, { name: 'Lat machine', id: 't_lat', pat: 'pull_v', tipo: 'fondamentale', mus: 'dorsali' }),
  C(/trazion|pull ?up|chin ?up/, { name: 'Trazioni', id: 't_trazioni', pat: 'pull_v', tipo: 'fondamentale', mus: 'dorsali' }),
  C(/pulley|rematore (al |ai |con )?cav|low row|seated row/, { name: 'Pulley basso', id: 'r_pulley', pat: 'pull_h', tipo: 'fondamentale', mus: 'dorsali e romboidi' }),
  C(/rematore (con |col |al )?bilanciere|barbell row|t-?bar/, { name: 'Rematore con bilanciere', id: 'r_bil', pat: 'pull_h', tipo: 'fondamentale', mus: 'dorsali' }),
  C(/rematore|\brow\b|pendlay/, { name: 'Rematore con manubrio', id: 'r_man', pat: 'pull_h', tipo: 'fondamentale', mus: 'dorsali' }),
  C(/scrollat|shrug/, { name: 'Scrollate', id: null, pat: 'pull_v', tipo: 'isolamento', mus: 'trapezio' }),
  C(/french ?press|push ?down|tricipit|kick ?back|estensioni (per i |dei )?tricipiti|skull/, { name: 'Esercizi per i tricipiti', id: null, pat: 'braccia', tipo: 'isolamento', mus: 'tricipiti' }),
  C(/curl|bicipit|hammer|martello/, { name: 'Curl per i bicipiti', id: null, pat: 'braccia', tipo: 'isolamento', mus: 'bicipiti' }),
  C(/russian twist|twist/, { name: 'Russian twist', id: null, pat: 'core', tipo: 'isolamento', mus: 'obliqui', contra: ['schiena'] }),
  C(/crunch|addominal|sit ?up|rollout|ab wheel/, { name: 'Crunch / addominali', id: 'c_crunch', pat: 'core', tipo: 'isolamento', mus: 'addominali' }),
  C(/plank/, { name: 'Plank', id: 'c_plank', pat: 'core', tipo: 'complementare', mus: 'core' }),
  C(/farmer|contadino/, { name: 'Farmer walk', id: 'c_farmer', pat: 'core', tipo: 'complementare', mus: 'core e presa' }),
  C(/tapis|corsa|camminata/, { name: 'Tapis roulant', id: 'x_salita', pat: 'cardio', tipo: 'cardio', mus: 'cuore' }),
  C(/cyclette|bike|spinning|bici/, { name: 'Cyclette', id: 'x_bici', pat: 'cardio', tipo: 'cardio', mus: 'cuore' }),
  C(/ellittic/, { name: 'Ellittica', id: 'x_ellittica', pat: 'cardio', tipo: 'cardio', mus: 'cuore' }),
  C(/vogator|rower/, { name: 'Vogatore', id: 'x_vogatore', pat: 'cardio', tipo: 'cardio', mus: 'cuore' }),
  C(/stepper|scala/, { name: 'Stepper', id: 'x_salita', pat: 'cardio', tipo: 'cardio', mus: 'cuore' }),
];

const PAT_LABEL = { squat: 'squat (gambe)', lunge: 'affondi (una gamba)', hinge: 'cerniera d’anca (catena posteriore)', push_h: 'spinta orizzontale (petto)', push_v: 'spinta verticale (spalle)', pull_h: 'tirata orizzontale (schiena)', pull_v: 'tirata verticale (dorsali)', core: 'core', glutei: 'glutei', calf: 'polpacci', braccia: 'braccia', cardio: 'cardio' };

// ------------------------------------------------------------------
// Riconoscimento del testo
// ------------------------------------------------------------------

export function parseGymList(text) {
  const t = String(text || '').toLowerCase().replace(/[’`]/g, "'");
  const parts = t.split(/\n|;|,|\.\s|\s+e\s+(?=[a-zà-ù])|\s*\+\s*/).map((s) => s.trim()).filter((s) => s.length > 1);
  const out = [];
  for (const raw of parts) {
    const e = CATALOG.find((c) => c.re.test(raw));
    const sr = raw.match(/(\d+)\s*(?:x|×|serie da|serie di|per)\s*(\d+)/);
    const kg = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili)/);
    const clean = raw.replace(/\d+\s*(x|×|serie.*|per)\s*\d+.*$|\d+(?:[.,]\d+)?\s*(kg|chili).*$/g, '').replace(/^(faccio|poi|anche|il|la|lo|le|i|gli)\s+/, '').trim();
    if (!e && !/[a-z]{3}/.test(clean)) continue;
    out.push({ raw: clean || raw, key: e ? e.name : null, sets: sr ? +sr[1] : null, reps: sr ? +sr[2] : null, kg: kg ? +kg[1].replace(',', '.') : null });
  }
  // un esercizio riconosciuto una sola volta
  const seen = new Set();
  return out.filter((x) => { const k = x.key || x.raw; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ------------------------------------------------------------------
// Scelta dalla lista (senza scrivere): modifica il testo della scheda riga per riga,
// così il testo resta l'unica fonte e l'analisi non cambia.
// ------------------------------------------------------------------

export const GYM_GROUPS = [
  { id: 'gambe', label: 'Gambe e glutei', pats: ['squat', 'lunge', 'hinge', 'glutei', 'calf'] },
  { id: 'petto', label: 'Petto', pats: ['push_h'] },
  { id: 'schiena', label: 'Schiena', pats: ['pull_h', 'pull_v'] },
  { id: 'spalle', label: 'Spalle', pats: ['push_v'] },
  { id: 'braccia', label: 'Braccia', pats: ['braccia'] },
  { id: 'core', label: 'Addominali e core', pats: ['core'] },
  { id: 'cardio', label: 'Cardio e macchine aerobiche', pats: ['cardio'] },
];

// nome mostrato e scritto nella scheda: deve essere riconosciuto di nuovo come lo stesso esercizio
const PICK_LABEL = { 'Esercizi per i tricipiti': 'Tricipiti ai cavi (push down)', 'Curl per i bicipiti': 'Curl bicipiti', 'Step-up': 'Step up', 'Alzate posteriori': 'Rear delt machine (alzate posteriori)' };

/** voci selezionabili, una per esercizio del catalogo, raggruppate per zona */
export function pickerGroups() {
  const seen = new Set();
  const entries = CATALOG.filter((c) => !seen.has(c.name) && seen.add(c.name));
  return GYM_GROUPS.map((g) => ({
    ...g,
    items: entries.filter((c) => g.pats.includes(c.pat)).map((c) => ({ key: c.name, label: PICK_LABEL[c.name] || c.name, cardio: c.pat === 'cardio' })),
  })).filter((g) => g.items.length);
}

// kg col punto: la virgola separa gli esercizi
const itemLine = (x) => `${x.raw}${x.sets ? ` ${x.sets}x${x.reps}` : ''}${x.kg ? ` ${x.kg} kg` : ''}`;
const linesOf = (text) => String(text || '').split('\n');

/** esercizi del catalogo già nella scheda, con serie, ripetizioni e kg */
export function pickedFromText(text) {
  const out = {};
  for (const x of parseGymList(text)) if (x.key && !out[x.key]) out[x.key] = { sets: x.sets, reps: x.reps, kg: x.kg };
  return out;
}

// riscrive la riga che contiene l'esercizio `key`; fn(item) → item aggiornato o null per toglierlo
function editLine(text, key, fn) {
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    const items = parseGymList(lines[i]);
    const j = items.findIndex((x) => x.key === key);
    if (j < 0) continue;
    // riga con un solo esercizio: il nome resta come l'ha scritto l'utente (maiuscole comprese)
    const orig = lines[i].replace(/\s*\d+\s*(x|×|serie.*|per)\s*\d+.*$|\s*\d+(?:[.,]\d+)?\s*(kg|chili).*$/gi, '').trim();
    const next = fn(items.length === 1 && orig ? { ...items[j], raw: orig } : items[j]);
    if (items.length === 1) { if (next) lines[i] = itemLine(next); else lines.splice(i, 1); }
    else { if (next) items[j] = next; else items.splice(j, 1); lines[i] = items.map(itemLine).join(', '); }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n/, '');
  }
  return null;
}

const append = (text, line) => (String(text || '').trim() ? `${String(text).replace(/\s+$/, '')}\n${line}` : line);

/** aggiunge l'esercizio se manca, lo toglie se c'è */
export function togglePick(text, key, label = PICK_LABEL[key] || key) {
  const removed = editLine(text, key, () => null);
  return removed !== null ? removed : append(text, label);
}

/** imposta serie×ripetizioni e kg di un esercizio (lo aggiunge se manca) */
export function setPickDetail(text, key, { sets, reps, kg }, label = PICK_LABEL[key] || key) {
  const upd = (x) => ({ ...x, sets: sets || null, reps: sets ? reps : null, kg: kg || null });
  const done = editLine(text, key, upd);
  return done !== null ? done : append(text, itemLine(upd({ raw: label })));
}

/** frasi del racconto che elencano esercizi di palestra */
export function gymFromNarrative(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/(?:in palestra (?:faccio|di solito faccio|faccio di solito|mi alleno con|i miei esercizi sono)|(?:faccio|di solito faccio) in palestra|i miei esercizi (?:in palestra )?sono|la mia scheda (?:è|prevede|ha|comprende))[:\s]+([^.]+)/);
  if (!m) return [];
  return parseGymList(m[1]).filter((x) => x.key);
}

// ------------------------------------------------------------------
// Analisi
// ------------------------------------------------------------------

const NEED = {
  base: ['squat', 'hinge', 'push_h', 'pull_h', 'pull_v', 'core'],
  massa: ['squat', 'hinge', 'push_h', 'push_v', 'pull_h', 'pull_v', 'lunge', 'core'],
  tonificare: ['squat', 'hinge', 'push_h', 'pull_h', 'pull_v', 'lunge', 'core'],
};

export function reviewGym(p, list, ctx = {}) {
  const items = list.map((x) => {
    const e = CATALOG.find((c) => c.name === x.key) || null;
    return { ...x, entry: e, name: e ? e.name : x.raw };
  });
  const goal = p.obiettivo;
  const res = [];

  // 1) sicurezza e livello
  for (const it of items) {
    const e = it.entry;
    if (!e) { res.push({ ...it, verdict: 'sconosciuto', reason: 'Non lo riconosco: resta nella tua scheda così com’è.' }); continue; }
    let verdict = 'tieni', reason = '', alt = null;
    if (e.risky) { verdict = 'cambia'; reason = `Sconsigliato: ${e.risky}.`; }
    const condHit = (e.contra || []).find((c) => (p.condizioni || []).includes(c) || Number(p.dolori?.[{ schiena: 'lombare' }[c] || c] || 0) >= 2);
    if (condHit) { verdict = 'cambia'; reason = `Con il tuo ${condHit === 'schiena' ? 'mal di schiena' : `problema a ${condHit}`} è meglio un’alternativa.`; }
    if (e.id && BY_ID[e.id]) {
      const chk = checkExercise(e.id, p, ctx);
      if (!chk.ok && chk.kind === 'salute') { verdict = 'cambia'; reason = chk.reason; }
      else if (!chk.ok && chk.kind === 'livello' && verdict === 'tieni') { verdict = 'cautela'; reason = chk.reason; }
    }
    if (verdict === 'cambia') {
      const alts = e.id ? alternativesFor(e.id, p, ctx) : [];
      const pick = alts.find((a) => a.eq.some((q) => ['palestra', 'manubri', 'sbarra'].includes(q))) || alts[0] || (e.pat && suggestForPattern(e.pat, p, ctx));
      if (pick) alt = { id: pick.id, name: pick.n };
    }
    res.push({ ...it, verdict, reason, alt });
  }

  // 2) doppioni e troppo isolamento
  const byPat = {};
  for (const r of res.filter((x) => x.entry && x.verdict !== 'cambia')) (byPat[r.entry.pat] = byPat[r.entry.pat] || []).push(r);
  for (const [pat, arr] of Object.entries(byPat)) {
    if (arr.length >= 3 && pat !== 'braccia' && pat !== 'cardio') {
      const iso = arr.filter((x) => x.entry.tipo === 'isolamento');
      for (const x of (iso.length ? iso : arr.slice(2)).slice(0, arr.length - 2)) {
        x.verdict = 'togli'; x.reason = `Doppione: per ${PAT_LABEL[pat]} hai già ${arr.filter((y) => y !== x).map((y) => y.name).join(' e ')}.`;
      }
    }
  }
  const strength = res.filter((x) => x.entry && x.entry.tipo !== 'cardio');
  const iso = strength.filter((x) => x.entry.tipo === 'isolamento' && x.verdict === 'tieni');
  const fond = strength.filter((x) => x.entry.tipo === 'fondamentale');
  if (goal !== 'massa' && iso.length > Math.max(2, fond.length)) {
    for (const x of iso.filter((y) => ['braccia', 'push_v', 'pull_v', 'glutei'].includes(y.entry.pat)).slice(0, iso.length - fond.length)) {
      x.verdict = 'riduci'; x.reason = `Per ${goal === 'dimagrire' ? 'dimagrire' : 'il tuo obiettivo'} rendono di più gli esercizi multiarticolari: tienilo a fine allenamento solo se hai tempo.`;
    }
  }

  // 3) schemi mancanti
  // uno schema è coperto anche quando l'esercizio da cambiare ha già un'alternativa
  const have = new Set(res.filter((x) => x.entry && (x.verdict !== 'cambia' || x.alt)).map((x) => x.entry.pat));
  if (have.has('lunge')) have.add('squat');
  const need = NEED[goal] || NEED.base;
  const weak = ctx.cp?.weak?.map((a) => a.id) || [];
  const add = [];
  for (const pat of need) {
    if (have.has(pat)) continue;
    const s = suggestForPattern(pat, p, ctx);
    if (s) add.push({ id: s.id, name: s.n, pat, reason: `Manca ${PAT_LABEL[pat]}.` });
  }
  if (weak.includes('core') && !add.some((a) => a.pat === 'core')) {
    const s = suggestForPattern('core', p, ctx, ['c_crunch']);
    if (s) add.push({ id: s.id, name: s.n, pat: 'core', reason: 'Il tuo core è risultato debole nei test: aggiungi un esercizio di stabilità.' });
  }

  // 4) equilibrio e note
  const notes = [];
  const push = res.filter((x) => x.entry && ['push_h', 'push_v'].includes(x.entry.pat) && x.verdict !== 'togli').length;
  const pull = res.filter((x) => x.entry && ['pull_h', 'pull_v'].includes(x.entry.pat) && x.verdict !== 'togli').length;
  if (push > pull + 1) {
    notes.push(`Squilibrio spinta/tirata: ${push} esercizi di spinta e ${pull} di tirata. ${p.lavoro === 'sedentario' ? 'Lavorando al pc le spalle tendono già a chiudersi in avanti: ' : ''}porta le tirate almeno allo stesso numero delle spinte.`);
    if (!add.some((a) => a.pat.startsWith('pull'))) { const s = suggestForPattern('pull_h', p, ctx); if (s) add.push({ id: s.id, name: s.n, pat: 'pull_h', reason: 'Per riequilibrare spinta e tirata.' }); }
  }
  if (['dimagrire', 'tonificare', 'resistenza', 'salute'].includes(goal) && !have.has('cardio')) notes.push('Non hai attività cardio: nel tuo piano ogni sessione in palestra chiude con 8 minuti di finisher cardio.');
  if (goal === 'massa' && fond.length < 4) notes.push('Per la massa costruisci la scheda attorno ad almeno 4 esercizi multiarticolari con carichi progressivi.');
  // nel piano: gli esercizi da tenere e, al posto di quelli da cambiare, le alternative
  const keep = [...new Set([
    ...res.filter((x) => x.entry?.id && ['tieni', 'cautela'].includes(x.verdict)).map((x) => x.entry.id),
    ...res.filter((x) => x.verdict === 'cambia' && x.alt).map((x) => x.alt.id),
  ])];
  const covered = need.filter((pat) => have.has(pat)).length;
  return { items: res, add, notes, keep, coverage: Math.round((covered / need.length) * 100) };
}

export const VERDICT_COUNT = { tieni: 'da tenere', cautela: 'con cautela', cambia: 'da cambiare', riduci: 'da ridurre', togli: 'da togliere', sconosciuto: 'non riconosciuti' };
export const VERDICT_LABEL = { tieni: 'Tieni', cautela: 'Tieni con cautela', cambia: 'Cambia', riduci: 'Riduci', togli: 'Togli', sconosciuto: 'Non riconosciuto' };
