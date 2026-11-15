// Giornata flessibile: in base a come stai oggi propone come cambiare la settimana
// (fare come previsto, versione corta, scambiare due giorni, spostare, riposare e fare un doppio, recupero attivo).
// Il calcolo è offline; l'AI può solo scegliere tra queste opzioni e spiegare perché.
//
// Modello dei giorni (state.log[iso]):
//   sessionFrom: giorno della settimana (0–6) la cui sessione si fa oggi · -1 = riposo
//   extra: giorno della settimana di una seconda sessione nella stessa giornata (doppio)
//   short: minuti della versione corta della sessione di oggi

const WD = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const KIND_W = { forza: 3, cardio: 2, mobilita: 1 };

/** la sessione davvero prevista in un giorno, tenendo conto degli spostamenti */
export function effectiveIndex(log, i) {
  const f = log?.sessionFrom;
  return f === undefined || f === null ? i : f;
}

/**
 * Opzioni per oggi.
 * week: [{ weekday, iso, session, log }] i 7 giorni della settimana, in ordine · today: indice di oggi (0–6)
 * a: risposte { energia: bassa|media|alta, tempo: minuti, dolore: bool, sonno: poco|ok, impegni: [indici dei giorni pieni] }
 */
export function dayOptions(week, today, a) {
  const out = [];
  const t = week[today];
  const busy = new Set(a.impegni || []);
  const effToday = effectiveIndex(t.log, today);
  const S = effToday >= 0 ? week[effToday].session : null;
  const done = (d) => d.log?.done;
  // giorni futuri di questa settimana
  const future = week.filter((d) => d.weekday > today && !busy.has(d.weekday) && !done(d));
  const sessOf = (d) => { const e = effectiveIndex(d.log, d.weekday); return e >= 0 ? week[e].session : null; };
  const tired = a.energia === 'bassa' || a.sonno === 'poco';
  const hasTime = (m) => a.tempo >= m * 0.85;
  const patch = (iso, p) => ({ iso, patch: p });
  const add = (o) => out.push(o);

  if (t.log?.done) return [{ id: 'fatto', title: 'Oggi hai già fatto', text: 'L’allenamento di oggi è completato: goditi il recupero.', apply: [], score: 100 }];

  if (S) {
    // 1) come previsto
    if (hasTime(S.minutes) && !a.dolore) {
      add({ id: 'previsto', title: `Fai ${S.title.toLowerCase()} come previsto`, text: `${S.minutes} minuti. ${a.energia === 'alta' ? 'Hai energia: è il giorno giusto.' : 'Hai il tempo che serve.'}`, apply: [], score: a.energia === 'alta' ? 90 : tired ? 40 : 75 });
    }
    // 2) versione corta
    if (a.tempo >= 10 && a.tempo < S.minutes * 0.85) {
      const m = Math.max(10, Math.floor(a.tempo / 5) * 5);
      add({ id: 'corta', title: `Versione corta da ${m} minuti`, text: `Stesso tipo di allenamento, ricostruito sul tempo che hai. Meglio ${m} minuti oggi che saltare.`, minutes: m, apply: [patch(t.iso, { short: m })], score: tired ? 55 : 70 });
    }
    // 2b) stanco ma con tempo: versione leggera, più breve
    if (tired && !a.dolore && a.tempo >= S.minutes * 0.85 && S.minutes >= 20) {
      const m = Math.max(10, Math.round((S.minutes * 0.6) / 5) * 5);
      add({ id: 'leggera', title: `Versione leggera da ${m} minuti`, text: 'Meno esercizi e meno serie: ti muovi, mantieni l’abitudine e non accumuli fatica.', minutes: m, apply: [patch(t.iso, { short: m })], score: 66 });
    }
    // 3) scambia con un giorno più avanti che ha una sessione più adatta a oggi
    for (const d of future) {
      const X = sessOf(d);
      if (!X || X === S) continue;
      const lighter = (KIND_W[X.kind] || 2) < (KIND_W[S.kind] || 2);
      const fits = hasTime(X.minutes) && !hasTime(S.minutes);
      if ((tired && lighter) || fits) {
        add({
          id: `scambia-${d.weekday}`, title: `Scambia con ${WD[d.weekday]}`,
          text: `Oggi ${X.title.toLowerCase()} (${X.minutes} min)${lighter ? ', più leggero' : ''}; ${S.title.toLowerCase()} si sposta a ${WD[d.weekday]}.`,
          apply: [patch(t.iso, { sessionFrom: effectiveIndex(d.log, d.weekday) }), patch(d.iso, { sessionFrom: effToday })],
          score: (tired && lighter ? 72 : 60) - (d.weekday - today), day: d.weekday,
        });
      }
    }
    // 4) sposta in un giorno libero (nessuna sessione) più avanti
    const free = future.filter((d) => !sessOf(d));
    if (free.length && (!hasTime(S.minutes) || tired || a.dolore)) {
      const d = free[0];
      add({ id: `sposta-${d.weekday}`, title: `Riposa oggi, alleni ${WD[d.weekday]}`, text: `${WD[d.weekday][0].toUpperCase() + WD[d.weekday].slice(1)} era un giorno di riposo: ci porto ${S.title.toLowerCase()}.`, apply: [patch(t.iso, { sessionFrom: -1 }), patch(d.iso, { sessionFrom: effToday })], score: tired ? 68 : 58, day: d.weekday });
    }
    // 5) riposo oggi e doppio allenamento un altro giorno (solo se i due insieme restano sostenibili)
    for (const d of future) {
      const X = sessOf(d);
      if (!X || d.log?.extra !== undefined) continue;
      const tot = X.minutes + S.minutes;
      const bothStrength = X.kind === 'forza' && S.kind === 'forza';
      if (tot <= 100 && !bothStrength) {
        add({ id: `doppio-${d.weekday}`, title: `Riposa oggi, doppio ${WD[d.weekday]}`, text: `${WD[d.weekday][0].toUpperCase() + WD[d.weekday].slice(1)} fai ${X.title.toLowerCase()} e ${S.title.toLowerCase()}: ${tot} minuti, meglio in due momenti della giornata.`, apply: [patch(t.iso, { sessionFrom: -1 }), patch(d.iso, { extra: effToday })], score: (free.length ? 45 : 62) - (tired ? 0 : 8), day: d.weekday });
        break;
      }
    }
    // 6b) saltare oggi: sempre possibile, ma è l'ultima scelta
    if (!out.some((o) => o.id === 'recupero' || o.id.startsWith('sposta'))) {
      add({ id: 'salta', title: 'Oggi salto', text: 'Una sessione saltata non cambia i risultati, se domani riparti. Fai almeno una camminata.', apply: [patch(t.iso, { sessionFrom: -1 })], score: tired ? 35 : 20 });
    }
    // 6) recupero attivo
    if (a.dolore || (a.energia === 'bassa' && a.sonno === 'poco')) {
      add({ id: 'recupero', title: 'Oggi solo recupero attivo', text: `15 minuti di mobilità e una camminata. ${a.dolore ? 'Con un dolore nuovo non si carica: se dura più di 2–3 giorni, fallo vedere.' : 'Dormire poco e sentirsi scarichi è il segnale che il corpo chiede recupero.'} ${S.title} si recupera ${free[0] ? WD[free[0].weekday] : 'la prossima settimana'}.`, apply: [patch(t.iso, { sessionFrom: -1, recupero: true }), ...(free[0] ? [patch(free[0].iso, { sessionFrom: effToday })] : [])], score: a.dolore ? 95 : 80 });
    }
  } else {
    // giorno di riposo: se c'è energia, si può anticipare
    for (const d of future) {
      const X = sessOf(d);
      if (!X || !hasTime(X.minutes) || tired || a.dolore) continue;
      add({ id: `anticipa-${d.weekday}`, title: `Anticipa ${X.title.toLowerCase()}`, text: `Lo fai oggi e ${WD[d.weekday]} diventa giorno di riposo${busy.size ? ', utile se quel giorno sei pieno di impegni' : ''}.`, apply: [patch(t.iso, { sessionFrom: effectiveIndex(d.log, d.weekday) }), patch(d.iso, { sessionFrom: -1 })], score: a.energia === 'alta' ? 70 : 50, day: d.weekday });
      break;
    }
    add({ id: 'riposo', title: 'Resta a riposo', text: 'Oggi era previsto il recupero: una camminata e qualche allungamento bastano.', apply: [], score: 65 });
  }

  // impegni: una sessione futura cade in un giorno pieno → spostala dove c'è posto
  for (const i of busy) {
    const d = week[i];
    if (!d || i <= today || done(d)) continue;
    const X = sessOf(d);
    if (!X) continue;
    const dest = week.find((w) => w.weekday > today && w.weekday !== i && !busy.has(w.weekday) && !sessOf(w) && !done(w));
    if (dest) add({ id: `libera-${i}`, title: `Libera ${WD[i]}`, text: `${X.title} si sposta a ${WD[dest.weekday]}, che era libero.`, apply: [patch(d.iso, { sessionFrom: -1 }), patch(dest.iso, { sessionFrom: effectiveIndex(d.log, i) })], score: 50, day: dest.weekday, extraChange: true });
  }

  out.sort((x, y) => y.score - x.score);
  return out;
}

/** applica le modifiche di un'opzione ai log e restituisce come tornare indietro */
export function applyOption(log, opt) {
  const undo = [];
  for (const { iso, patch } of opt.apply) {
    const cur = log[iso] || (log[iso] = { done: false, items: [], habits: {} });
    const prev = {};
    for (const k of Object.keys(patch)) prev[k] = cur[k];
    undo.push({ iso, prev });
    Object.assign(cur, patch);
  }
  return undo;
}
export function undoOption(log, undo) {
  for (const { iso, prev } of undo || []) {
    const cur = log[iso];
    if (!cur) continue;
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete cur[k]; else cur[k] = v; }
  }
}
